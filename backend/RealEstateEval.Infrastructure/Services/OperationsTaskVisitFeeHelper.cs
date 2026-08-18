using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class OperationsTaskVisitFeeHelper
{
    private readonly OperationsDbContext _ops;
    private readonly ICourtVisitFeeChargeService _charges;
    private readonly IIdentityDirectory _identity;
    private readonly IPartyFeePricingService _pricing;
    private readonly TimeProvider _time;

    public OperationsTaskVisitFeeHelper(
        OperationsDbContext ops,
        FinancialDbContext financial,
        IdentityDbContext identity,
        IPartyFeePricingService pricing,
        TimeProvider? time = null)
        : this(ops, new CourtVisitFeeChargeService(financial, time), new IdentityDirectory(identity), pricing, time)
    {
    }

    [ActivatorUtilitiesConstructor]
    public OperationsTaskVisitFeeHelper(
        OperationsDbContext ops,
        ICourtVisitFeeChargeService charges,
        IIdentityDirectory identity,
        IPartyFeePricingService pricing,
        TimeProvider? time = null)
    {
        _ops = ops;
        _charges = charges;
        _identity = identity;
        _pricing = pricing;
        _time = time ?? TimeProvider.System;
    }

 /// <summary>
 /// Create-time visit fee for court_visit: employees get none; cooperators need an amount
 /// (request value, else the active table default).
 /// </summary>
    public async Task<(decimal? Fee, Guid? PricingTableId, string? Error)> ResolveCreateVisitFeeAsync(
        string assigneeId,
        decimal? requestedAmount,
        CancellationToken cancellationToken)
    {
        var reviewerType = await ResolveReviewerTypeAsync(assigneeId, cancellationToken);

        if (!CourtVisitFeeRules.RequiresVisitFee(reviewerType))
        {
            if (requestedAmount is not null)
                return (null, null, "المراجع الموظف لا يستحق أتعاب زيارة — الحوافز عبر جدول flat.");
            return (null, null, null);
        }

        if (requestedAmount is > 0m)
        {
 // Keep provenance when the specialist edited a table default.
            var tableHint = await _pricing.ResolveDefaultFeeAsync(
                WorkflowTaskKind.GovernmentReview,
                CourtVisitFeeRules.PartyType,
                areaM2: null,
                assigneeId,
                cancellationToken);
            return (requestedAmount, tableHint.PricingTableId, null);
        }

        if (requestedAmount is <= 0m)
            return (null, null, "مبلغ أتعاب الزيارة يجب أن يكون أكبر من صفر.");

        var fromTable = await _pricing.ResolveDefaultFeeAsync(
            WorkflowTaskKind.GovernmentReview,
            CourtVisitFeeRules.PartyType,
            areaM2: null,
            assigneeId,
            cancellationToken);
        if (!fromTable.IsResolved)
            return (null, null, PricingErrors.FeeUnresolved);

        return (fromTable.FeeSar, fromTable.PricingTableId, null);
    }

 /// <summary>
 /// Resolves the fee to charge on complete. Employees and already-charged visits return
 /// unresolved with no error. Cooperators require a positive amount (stamped on create, or
 /// recovered from the active table if the stamp is missing) — never complete silently unpaid.
 /// </summary>
    public async Task<(ResolvedPartyFee Fee, string? Error)> ResolveCourtVisitFeeAsync(
        OperationsTask entity,
        CancellationToken cancellationToken)
    {
        var alreadyCharged = await _charges.ExistsForTaskAsync(entity.Id, cancellationToken);
        if (alreadyCharged) return (ResolvedPartyFee.Unresolved, null);

        var payeeId = (entity.CreditAssigneeId ?? entity.AssigneeId).Trim();
        var reviewerType = await ResolveReviewerTypeAsync(payeeId, cancellationToken);

        if (!CourtVisitFeeRules.RequiresVisitFee(reviewerType))
        {
 // Employee path: no visit charge (incentives are out of band).
            if (entity.AgreedVisitFeeSar is > 0m)
            {
 // Stale stamp after classification changed — do not invent a charge for an employee.
                return (ResolvedPartyFee.Unresolved, null);
            }

            return (ResolvedPartyFee.Unresolved, null);
        }

        if (entity.AgreedVisitFeeSar is > 0m)
            return (new ResolvedPartyFee(entity.AgreedVisitFeeSar, entity.VisitFeePricingTableId), null);

        if (entity.AgreedVisitFeeSar is <= 0m)
            return (ResolvedPartyFee.Unresolved, PricingErrors.FeeUnresolved);

 // Cooperator task left without a create-time stamp — recover from the active table once.
        var fromTable = await _pricing.ResolveDefaultFeeAsync(
            WorkflowTaskKind.GovernmentReview,
            CourtVisitFeeRules.PartyType,
            areaM2: null,
            payeeId,
            cancellationToken);
        if (!fromTable.IsResolved)
            return (ResolvedPartyFee.Unresolved, PricingErrors.FeeUnresolved);

        entity.StampAgreedVisitFee(
            fromTable.FeeSar!.Value,
            fromTable.PricingTableId,
            _time.UtcNow());

        return (fromTable, null);
    }

    public Task AddCourtVisitFeeChargeAsync(
        OperationsTask entity,
        ResolvedPartyFee fee,
        CancellationToken cancellationToken = default) =>
        _charges.AddChargeAsync(
            new CreateCourtVisitFeeChargeRequest
            {
                OperationsTaskId = entity.Id,
                TaskDisplayId = entity.DisplayId,
                PoNumber = OperationsTaskSerialization.NullIfBlank(entity.PoNumber),
                CreditAssigneeId = (entity.CreditAssigneeId ?? entity.AssigneeId).Trim(),
                CreditAssigneeName = string.IsNullOrWhiteSpace(entity.CreditAssigneeName)
                    ? entity.AssigneeName
                    : entity.CreditAssigneeName.Trim(),
                AmountSar = fee.FeeSar!.Value,
                PricingTableId = fee.PricingTableId,
            },
            cancellationToken);

 /// <summary>
 /// Opens charges for completed cooperator court visits that finished without a stamp
 /// (employee→cooperator classification change, or pre-fix silent complete). Idempotent.
 /// </summary>
    public async Task<int> BackfillMissingChargesForCompletedVisitsAsync(
        CancellationToken cancellationToken = default)
    {
        var chargedTaskIds = await _charges.ListChargedTaskIdsAsync(cancellationToken);
        var charged = chargedTaskIds.ToHashSet();

        var orphans = await _ops.OperationsTasks
            .Where(t => t.Type == OperationsTaskType.CourtVisit
                && t.Status == OperationsTaskStatus.Completed
                && !charged.Contains(t.Id))
            .OrderBy(t => t.UpdatedAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        if (orphans.Count == 0)
            return 0;

        var added = 0;
        foreach (var task in orphans)
        {
            var (fee, error) = await ResolveCourtVisitFeeAsync(task, cancellationToken);
            if (error is not null || !fee.IsResolved)
                continue;

            await AddCourtVisitFeeChargeAsync(task, fee, cancellationToken);
            added++;
        }

        return added;
    }

    public Task SaveChargesAsync(CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    private async Task<string> ResolveReviewerTypeAsync(
        string assigneeId,
        CancellationToken cancellationToken)
    {
        var profile = await _identity.GetCompensationByAssigneeAsync(assigneeId, cancellationToken);

        return CourtVisitFeeRules.ResolveReviewerType(
            profile?.ContractType,
            profile?.ProviderKind,
            profile?.EmploymentType,
            assigneeId);
    }
}


