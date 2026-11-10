using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>Freeze guard — after deposit copy, nothing is editable except code and certificate.</summary>
public static class ValuationReportFreeze
{
    public const string FrozenMessageAr = ValuationReportFreezeRules.FrozenMessageAr;

    // Freeze follows the current copy only — reopen (superseding) lifts the
    // Layer only; freeze of adopted party outputs is a lower layer untouched (2-C).
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
    /// </summary>
    /// <remarks>
    /// How it works: «none» (the property has no appraisal task — a legacy valuation) and any package not
    /// submitted are open; «submitted» locks. A failed read or an empty answer refuses with
    /// <see cref="ValuationReportFreezeRules.PackageStateUnavailableMessageAr"/> («تعذّر التحقق من حالة
    /// دراسة الحالة — حاول مرة أخرى»), so a lock can never be skipped by an outage.
    /// Edge cases + fixed 2026-11-10: an empty answer (null / 404) used to count as «not locked» while the
    /// draft writes refused it and the deposit step passed it — the three now agree: refuse. No lookup wired
    /// (tests) or no property still means only the deposit layer applies.
    /// </remarks>
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

        if (state is null)
            return ValuationReportFreezeRules.PackageStateUnavailableMessageAr;
        return string.Equals(state.PackageStatus, PartyTaskSubmissionStatus.Submitted, StringComparison.Ordinal)
            ? ValuationReportFreezeRules.AppraiserSubmittedMessageAr
            : null;
    }
}