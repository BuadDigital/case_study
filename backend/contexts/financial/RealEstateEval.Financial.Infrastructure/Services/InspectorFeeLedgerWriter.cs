using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class InspectorFeeLedgerWriter : IInspectorFeeLedgerWriter
{
    private readonly FinancialDbContext _financial;
    private readonly ICaseStudyLookup _lookup;
    private readonly IPartyFeePricingService _pricing;
    private readonly IInspectorFeeLedgerResolver _resolver;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public InspectorFeeLedgerWriter(
        FinancialDbContext financial,
        ICaseStudyLookup lookup,
        IPartyFeePricingService pricing,
        IInspectorFeeLedgerResolver resolver,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _financial = financial;
        _lookup = lookup;
        _pricing = pricing;
        _resolver = resolver;
    }


    public async Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default)
    {
 // Engineering-survey fees accrue only on specialist acceptance — not here.
        var feeTasks = tasks
            .Where(t => t.Kind is WorkflowTaskKind.FieldInspection
                or WorkflowTaskKind.GovernmentReview)
            .ToList();
        if (feeTasks.Count == 0) return;

        var now = _time.UtcNow();
        var pendingTriples = new HashSet<(Guid TransactionId, Guid DeedId, string UserId)>();
        foreach (var task in feeTasks)
        {
            var partyType = await _resolver.ResolvePartyTypeAsync(task, cancellationToken);
            var isEmployee = InspectorFeeRules.IsEmployee(partyType);

 // Employee incentives require an active compensation flag and a resolved flat table.
 // Opening a zero draft for every employee was the hand-entry path replaces.
            if (isEmployee)
            {
                var hasCompensation = await _resolver.AssigneeHasCompensationAsync(
                    task.AssigneeId,
                    cancellationToken);
                if (!hasCompensation) continue;
            }

            var po = task.PoNumber.Trim();
            var deeds = await _resolver.ResolveDeedTargetsAsync(task, cancellationToken);
            var ordinal = 0;
            foreach (var deed in deeds)
            {
                ordinal++;
                var areaM2 = await _resolver.ResolvePropertyAreaM2Async(
                    task, cancellationToken, deed.PropertyId);
                var agreedFee = await _pricing.ResolveDefaultFeeAsync(
                    task.Kind,
                    partyType,
                    areaM2,
                    task.AssigneeId,
                    cancellationToken);

 // Unresolved means no rate yet — inventing zero here is exactly what we are removing.
                if (!agreedFee.IsResolved) continue;

                var identity = await _resolver.ResolveLedgerIdentityAsync(
                    task,
                    cancellationToken,
                    deed.DeedId);
 // same (transaction, deed, user) must not open a second line — even via another task.
                var tripleKey = (identity.TransactionId, identity.DeedId, identity.UserId);
                if (!pendingTriples.Add(tripleKey)) continue;
                var tripleExists = await _financial.InspectorFeeLedgers.AnyAsync(
                    x => x.TransactionId == identity.TransactionId
                        && x.DeedId == identity.DeedId
                        && x.UserId == identity.UserId,
                    cancellationToken);
                if (tripleExists) continue;

                var billingStatus = InspectorFeeBillingStatus.Draft;
                string? preSuspension = null;
                string? suspensionReason = null;
                if (isEmployee && !string.IsNullOrWhiteSpace(task.AssigneeId))
                {
                    var withhold = await _financial.IncentiveSuspensions.AsNoTracking()
                        .Where(x =>
                            x.AssigneeId == task.AssigneeId.Trim()
                            && x.TransactionKey == po
                            && x.LiftedAtUtc == null)
                        .Select(x => x.Reason)
                        .FirstOrDefaultAsync(cancellationToken);
                    if (withhold is not null)
                    {
                        billingStatus = InspectorFeeBillingStatus.Suspended;
                        preSuspension = InspectorFeeBillingStatus.Draft;
                        suspensionReason = withhold;
                    }
                }

                _financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
                {
                    Id = Guid.NewGuid(),
                    TransactionId = identity.TransactionId,
                    DeedId = identity.DeedId,
                    UserId = identity.UserId,
                    WorkflowTaskId = task.Id,
                    PoNumber = po,
                    PropertyId = deed.PropertyId,
                    PropertyOrdinal = deed.PropertyId == task.PropertyId
                        ? task.PropertyOrdinal
                        : ordinal,
                    AssigneeId = task.AssigneeId,
                    InspectorType = partyType,
                    SupervisingDepartment = SupervisingDepartments.ForTaskKind(task.Kind),
                    AgreedFeeSar = agreedFee.FeeSar!.Value,
                    PricingTableId = agreedFee.PricingTableId,
                    SupervisorDiscountSar = 0m,
                    DiscountReason = null,
                    BillingStatus = billingStatus,
                    PreSuspensionStatus = preSuspension,
                    SuspensionReason = suspensionReason,
                    ExcludedFromBatch = false,
                    ExclusionReason = null,
                    ReturnTo = null,
                    DisbursementBatchId = null,
                    DisbursementVoucher = null,
                    AccruedAtUtc = now,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
            }
        }

        await _financial.SaveChangesAsync(cancellationToken);
    }

    public async Task BackfillMissingLedgersAsync(CancellationToken cancellationToken = default)
    {
 // Engineering-survey ledgers are created only via AccrueEngineeringSurveyFeeAsync.
        var feeTasks = (await _lookup.ListWorkflowTasksByKindsAsync(
                [WorkflowTaskKind.FieldInspection, WorkflowTaskKind.GovernmentReview],
                cancellationToken))
            .Select(s => s.ToWorkflowTask())
            .ToList();
        if (feeTasks.Count == 0) return;

        var readyPropertyIds = await GetCompletedCaseStudyPropertyIdsAsync(
            feeTasks.Select(t => t.PropertyId),
            cancellationToken);

 // Property-linked tasks need completed case-study; PO-level tasks (null PropertyId) are
 // expanded per deed inside EnsureLedgersForTasksAsync.
        feeTasks = feeTasks
            .Where(t =>
                t.PropertyId is null
                || (t.PropertyId is Guid pid && readyPropertyIds.Contains(pid)))
            .ToList();
        if (feeTasks.Count == 0) return;

        await EnsureLedgersForTasksAsync(feeTasks, cancellationToken);
    }

    private async Task<HashSet<Guid>> GetCompletedCaseStudyPropertyIdsAsync(
        IEnumerable<Guid?> propertyIds,
        CancellationToken cancellationToken)
    {
        var ids = propertyIds
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0) return [];

        var ready = await _lookup.ListCompletedCaseStudyPropertyIdsAsync(cancellationToken);
        return ready.Where(ids.Contains).ToHashSet();
    }
}
