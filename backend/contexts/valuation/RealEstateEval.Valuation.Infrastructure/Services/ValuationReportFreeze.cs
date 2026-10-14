using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>Q-6: freeze guard — after deposit copy, nothing is editable except code and certificate.</summary>
public static class ValuationReportFreeze
{
    public const string FrozenMessageAr = ValuationReportFreezeRules.FrozenMessageAr;

    // R2: freeze follows the current copy only — reopen (superseding) lifts the
    // Q-6 layer only; freeze of adopted party outputs is a lower layer untouched (2-C).
    public static Task<bool> IsFrozenAsync(
        ValuationDbContext db,
        Guid valuationRequestId,
        CancellationToken cancellationToken = default) =>
        db.ValuationReportIssuances.AsNoTracking()
            .AnyAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);

    /// <summary>
    /// The deposit layer first (local), then the hand-over lock: the appraisal package of the
    /// request's property being submitted closes every valuation write until it is returned.
    /// A null/404 answer is an older Case Study host and counts as "not locked"; a failed read
    /// fails closed so a lock can never be skipped by an outage.
    /// </summary>
    public static async Task<string?> GetFrozenMessageAsync(
        ValuationDbContext db,
        ICaseStudyLookup? caseStudy,
        Guid valuationRequestId,
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        if (await IsFrozenAsync(db, valuationRequestId, cancellationToken))
            return FrozenMessageAr;
        if (caseStudy is null || propertyId == Guid.Empty)
            return null;

        RealEstateEval.Application.Contracts.CaseStudyAppraisalPackageStateDto? state;
        try
        {
            state = await caseStudy.GetAppraisalPackageStateAsync(propertyId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return ValuationReportFreezeRules.PackageStateUnavailableMessageAr;
        }

        return string.Equals(state?.PackageStatus, PartyTaskSubmissionStatus.Submitted, StringComparison.Ordinal)
            ? ValuationReportFreezeRules.AppraiserSubmittedMessageAr
            : null;
    }
}