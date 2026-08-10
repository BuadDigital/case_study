using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class OperationsTaskVisitFeeHelper
{
    private readonly ApplicationDbContext _db;
    private readonly IPartyFeePricingService _pricing;

    public OperationsTaskVisitFeeHelper(ApplicationDbContext db, IPartyFeePricingService pricing)
    {
        _db = db;
        _pricing = pricing;
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
        var profile = await _db.UserProfiles.AsNoTracking()
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .FirstOrDefaultAsync(p => p.DistributionAssigneeId == assigneeId, cancellationToken);
        var reviewerType = CourtVisitFeeRules.ResolveReviewerType(
            profile?.ContractType,
            profile?.ProcProvider?.ProviderKind,
            profile?.HrEmployee?.EmploymentType,
            assigneeId);

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
    /// Stamps the create-time agreed amount on complete. Employees and already-charged visits
    /// return unresolved with no error so completion can proceed without a second charge.
    /// </summary>
    public async Task<(ResolvedPartyFee Fee, string? Error)> ResolveCourtVisitFeeAsync(
        OperationsTask entity,
        CancellationToken cancellationToken)
    {
        var alreadyCharged = await _db.CourtVisitFeeCharges
            .AnyAsync(c => c.OperationsTaskId == entity.Id, cancellationToken);
        if (alreadyCharged) return (ResolvedPartyFee.Unresolved, null);

        if (entity.AgreedVisitFeeSar is null)
            return (ResolvedPartyFee.Unresolved, null);

        if (entity.AgreedVisitFeeSar <= 0m)
            return (ResolvedPartyFee.Unresolved, PricingErrors.FeeUnresolved);

        return (new ResolvedPartyFee(entity.AgreedVisitFeeSar, entity.VisitFeePricingTableId), null);
    }

    public void AddCourtVisitFeeCharge(OperationsTask entity, ResolvedPartyFee fee)
    {
        var now = DateTime.UtcNow;
        _db.CourtVisitFeeCharges.Add(new CourtVisitFeeCharge
        {
            Id = Guid.NewGuid(),
            OperationsTaskId = entity.Id,
            TaskDisplayId = entity.DisplayId,
            PoNumber = OperationsTaskSerialization.NullIfBlank(entity.PoNumber),
            CreditAssigneeId = (entity.CreditAssigneeId ?? entity.AssigneeId).Trim(),
            CreditAssigneeName = string.IsNullOrWhiteSpace(entity.CreditAssigneeName)
                ? entity.AssigneeName
                : entity.CreditAssigneeName.Trim(),
            AmountSar = fee.FeeSar!.Value,
            PricingTableId = fee.PricingTableId,
            Status = CourtVisitFeeStatuses.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
    }
}
