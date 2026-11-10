// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • The participant-credentials gate checks only the people on this report (ReportParticipants, incl.
//         the signing valuer and the assigned appraiser), not the whole roster.
//  • Alerts  Alert input gets each adopted comparable's adjusted unit rate, deal date and usage
//            via ToAlertComparable, plus the date cutoff from the valuation date, today and the
//            subject type.
//  • Wording  Alert note now «تنبيهات منهجية (24): 7 حاجبة · 12 بمبرر نصي إلزامي · 5 بإقرار».
//  • Split  Value-document and required-attachment reads moved to ValuationIssuanceGateService.Reads.cs (the
//           class is now partial).
// Round 2 (1b19bedc)
//  • Passes the engineering-survey task ids to the required-attachments read.
//  • B    New gates AdjustmentRationales for the market table and the land-within-cost table: an included
//         non-zero factor or a manual weight without a rationale of ≥ 10 characters blocks.
//  • Passes ComparableDateCutoffIsPeriodEnd — whether the cutoff is the end of a retrospective period.
// 2026-11-02 (colleague review, item 10)
//  • The AdjustmentRationales gates are gone: adjustment-factor and weight rationales are optional
//         notes (the percentages are estimates) — they no longer hold issue or hand-over.
// 2026-11-10 (grey areas)
//  • New gate cost_depreciation_complete: cost approach on + a building age missing blocks.
//  • «Reconciliation saved» = a stored row with a methods rationale (not a computed final value).
//  • Participants: firm license date first (the documented FirstFilled rule).
//  • Case-study state unknown (unreachable / empty answer) refuses; no case-study property (legacy) passes.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Aggregates credential + case-study match + gates + methodology alerts.
/// </summary>
public sealed partial class ValuationIssuanceGateService(
    ValuationDbContext valuation,
    ICaseStudyLookup caseStudy,
    IAttachmentLookup attachments,
    IOrganizationSettingsService organizationSettings,
    IAttachmentPrintDictionaryService printDictionary,
    IValuationComparableSelectionService selections,
    IValuationCostApproachService costApproach,
    IValuationReconciliationService reconciliation,
    IValuationValueDocumentService valueDocuments,
    IAssignedAppraiserCheck assignedAppraiser,
    TimeProvider clock) : IValuationIssuanceGateService
{
    public async Task<ValuationIssuanceGatesDto?> EvaluateAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await valuation.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var today = RiyadhClock.Today(clock);
        var org = await organizationSettings.GetInternalAsync(cancellationToken);
        var eval = org.Evaluator;
        var firmLicenseExpiresAt = ValuerCredentialRules.FirstFilled(
            org.Company.PracticeLicenseExpiresAt,
            eval.LicenseExpiresAt);

        var propertyId = vr.PropertyId.ToString("D");
        DeedKind deedKind = DeedKind.Traditional;
        string matchOutcome = DeedNatureMatchOutcomes.Unset;
        bool? studyReportIssued = null;
        var hasStructures = false;
        var propertyType = "";
        string? poNumber = null;
        var propertyRequiresSurvey = true;
        IReadOnlyList<Guid> surveyTaskIds = [];
 // Inspection boundaries — feed m18/m21.
        string? inspectionScopeKey = null;
        var uninspectedUnitCount = 0;
        string? inspectionRestrictionReason = null;
        var remoteInspectionApproved = false;
        bool? studyApprovedByReview = null;
        bool? valueAcceptedByReview = null;

        var propertyGuid = vr.PropertyId;
        // 2026-11-10: a valuation with no case-study property at all (legacy) passes the case-study gates;
        // one that has a property but whose state could not be read is refused («تعذّر التحقق»), never passed.
        var linkedToCaseStudy = propertyGuid != Guid.Empty;
        if (linkedToCaseStudy)
        {
            var context = await ReadPropertyContextAsync(propertyGuid, cancellationToken);
            if (context is not null)
            {
                deedKind = context.DeedKindValue();
                propertyType = context.EffectivePropertyType();
                poNumber = context.PoNumber;
                propertyRequiresSurvey = context.RequiresEngineeringSurvey;
                surveyTaskIds = context.SurveyTaskIds ?? [];
                hasStructures = context.HasStructures();
                inspectionScopeKey = string.IsNullOrWhiteSpace(context.InspectionScopeKey)
                    ? null
                    : context.InspectionScopeKey;
                uninspectedUnitCount = InspectionLimitsRules.TotalUninspectedUnits(
                    InspectionLimitsRules.ParseUnits(context.UninspectedUnitsJson));
                inspectionRestrictionReason = context.InspectionRestrictionReason;
                remoteInspectionApproved = context.RemoteInspectionApprovedAtUtc is not null;
                matchOutcome = context.DeedNatureMatchOutcome ?? "";
                studyReportIssued = context.StudyReportIssued;
                studyApprovedByReview = context.StudyApprovedByReview;
                valueAcceptedByReview = context.ValueAcceptedByReview;
            }
        }

        var assigneeId = propertyGuid == Guid.Empty
            ? null
            : (await assignedAppraiser.FindAppraisalTaskAsync(propertyGuid, cancellationToken))?.AssigneeId;

        var market = await selections.ListAsync(
            valuationRequestId,
            ComparableSelectionContexts.Market,
            cancellationToken);
        var landWithinCost = await selections.ListAsync(
            valuationRequestId,
            ComparableSelectionContexts.LandWithinCost,
            cancellationToken);
        var cost = await costApproach.GetAsync(valuationRequestId, cancellationToken);
        var recon = await reconciliation.GetAsync(valuationRequestId, cancellationToken);
        // 2026-11-10: «saved» = a stored reconciliation row with its methods rationale. The projection above
        // computes a final value (100% market by default) even when nothing was ever saved.
        var hasReconSaved = await valuation.ValuationReconciliations.AsNoTracking()
            .AnyAsync(
                x => x.ValuationRequestId == valuationRequestId && x.MethodsRationale.Trim() != "",
                cancellationToken);

        var costUsed = (cost?.CostOpinionWithLand ?? 0m) > 0m
            || (cost?.Lines.Count ?? 0) > 0;

 // Amended: cost alerts are irrelevant when the approach is off
 // (bare land defaults it off; land with structures keeps it available).
        var approachSettings = await valuation.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        // Unsaved settings follow the same defaults as the reconciliation and the report
        // (e.g. an apartment starts without the cost approach), not «everything on».
        var typeForRules = string.IsNullOrWhiteSpace(propertyType) ? vr.PropertyType : propertyType;
        var settings = approachSettings
            ?? ValuationApproachSettingsRules.Defaults(vr.Id, typeForRules, hasStructures);
        var marketApproachEnabled = settings.MarketApproachEnabled;
        var costApproachAllowed = ValuationApproachSettingsRules.CostApproachApplies(
            typeForRules,
            hasStructures,
            settings.CostScopeKey);
        hasStructures = ValuationApproachSettingsRules.BuildingsValued(
            hasStructures,
            settings.CostScopeKey);
        var costApproachEnabled = costApproachAllowed && settings.CostApproachEnabled;
        // "Building only" scope: land section hidden — its gates do not apply.
        var costLandRelevant = costApproachEnabled
            && !CostScopeKeys.IsBuildingOnly(settings.CostScopeKey);
        var costDepreciationIncomplete = costApproachEnabled
            && await CostDepreciationIncompleteAsync(valuationRequestId, cancellationToken);

        var checks = new List<ValuationIssuanceGateCheck>
        {
            ValuationIssuanceGateRules.Credentials(
                firmLicenseExpiresAt,
                eval.MembershipExpiresAt,
                today),
            // Only the people on THIS report — not the whole roster (one colleague's expired
            // membership used to block every appraiser's issuance).
            ValuationIssuanceGateRules.ParticipantCredentials(
                ValuationIssuanceGateInputRules.ReportParticipants(
                        org.Valuers,
                        eval.Name,
                        assigneeId,
                        vr.Appraiser)
                    // The documented rule (ValuerCredentialRules.FirstFilled): the firm's practice-license
                    // date first, the person's own date only when the firm's is empty (2026-11-10: was
                    // personal first, so a stale personal date overrode the firm's).
                    .Select(v => new ValuationIssuanceGateRules.RosterParticipantCredentials(
                        v.NameAr,
                        ValuerCredentialRules.FirstFilled(
                            firmLicenseExpiresAt,
                            v.LicenseExpiresAt),
                        v.MembershipExpiresAt))
                    .ToList(),
                today),
            ValuationIssuanceGateRules.DeedNatureMatch(deedKind, matchOutcome),
            ValuationIssuanceGateRules.StudyReportIssued(studyReportIssued, linkedToCaseStudy),
            ValuationIssuanceGateRules.MinAdoptedComparablesForApproach(
                "market",
                "مقارنات أسلوب السوق",
                marketApproachEnabled,
                market?.AdoptedCount ?? 0),
            ValuationIssuanceGateRules.MinAdoptedComparablesForApproach(
                "land_within_cost",
                "مقارنات الأرض ضمن التكلفة",
                costLandRelevant,
                landWithinCost?.AdoptedCount ?? 0),
            ValuationIssuanceGateRules.CostLandEstimateComplete(
                costLandRelevant,
                cost?.LandEstimateComplete == true),
            ValuationIssuanceGateRules.CostDepreciationComplete(
                costApproachEnabled,
                costDepreciationIncomplete),
            ValuationIssuanceGateRules.ComparableWeights(
                "market",
                "أوزان مقارنات أسلوب السوق = 100٪",
                marketApproachEnabled,
                market?.WeightsSumTo100 ?? true,
                marketApproachEnabled ? market?.AdoptedCount ?? 0 : 0),
            ValuationIssuanceGateRules.ComparableWeights(
                "land_within_cost",
                "أوزان مقارنات الأرض ضمن التكلفة = 100٪",
                costLandRelevant,
                landWithinCost?.WeightsSumTo100 ?? true,
                costLandRelevant ? landWithinCost?.AdoptedCount ?? 0 : 0),
            ValuationIssuanceGateRules.ReconciliationWeights(
                hasReconSaved,
                recon?.WeightsSumTo100 ?? false),
            ValuationIssuanceGateRules.FinalOpinion(recon?.FinalOpinionValue ?? 0m),
            ValuationIssuanceGateRules.RequiredAttachments(
                await FindMissingRequiredAttachmentLabelsAsync(
                    propertyId,
                    poNumber,
                    surveyTaskIds,
                    propertyType,
                    propertyRequiresSurvey,
                    cancellationToken)),
            await ValueDocumentsCheckAsync(valuationRequestId, cancellationToken),
        };

        var resolutions = (recon?.MethodologyAlertOverrides ?? [])
            .Select(o => new ValuationMethodologyAlertResolution(
                o.Code,
                o.OverrideRationale,
                o.Acknowledged))
            .ToList();

 // The structured restriction reason is the valuer's explanation of inspection limits —
 // it satisfies the m18 rationale without rewriting it in issuance gates (single source).
        if (!string.IsNullOrWhiteSpace(inspectionRestrictionReason)
            && resolutions.All(r => !string.Equals(
                r.Code,
                ValuationMethodologyAlertCodes.LimitedInspection,
                StringComparison.OrdinalIgnoreCase)))
        {
            resolutions.Add(new ValuationMethodologyAlertResolution(
                ValuationMethodologyAlertCodes.LimitedInspection,
                inspectionRestrictionReason));
        }

        var alertInput = new ValuationMethodologyAlertInput(
            HasStructuresToValue: hasStructures,
            CostApproachRelevant: costApproachEnabled && (costUsed || hasStructures),
            CostLines: (cost?.Lines ?? [])
                .Select(l => new ValuationMethodologyAlertCostLineInput(
                    l.StructureKind,
                    l.Label,
                    l.AreaSqm,
                    l.UnitCostSar,
                    l.Rationale,
                    l.IsIncluded,
                    l.ItemKey))
                .ToList(),
            AdoptedComparableCount: market?.AdoptedCount ?? 0,
            ComparableWeightsSumTo100: market?.WeightsSumTo100 ?? true,
            ReconciliationWeightsSumTo100: recon?.WeightsSumTo100 ?? false,
            HasReconciliationSaved: hasReconSaved,
            LiquidationDiscountPct: recon?.LiquidationDiscountPct ?? 0m,
            LiquidationDiscountRationale: recon?.LiquidationDiscountRationale,
            AdoptedComparables: (market?.Items ?? [])
                .Where(i => i.IsAdopted)
                .Select(i => ValuationIssuanceGateInputRules.ToAlertComparable(i, market?.AdjustmentBasis))
                .ToList(),
            // Alert 23 also covers the land comparables inside the cost approach (A→Z #77).
            AdoptedCostLandComparables: costLandRelevant
                ? (landWithinCost?.Items ?? [])
                    .Where(i => i.IsAdopted)
                    .Select(i => ValuationIssuanceGateInputRules.ToAlertComparable(i, landWithinCost?.AdjustmentBasis))
                    .ToList()
                : null,
            UseRestrictionDiscountPct: cost?.UseRestrictionDiscountPct ?? 0m,
            UseRestrictionRationale: cost?.UseRestrictionRationale,
            DeveloperProfitPct: cost?.IndirectItems
                .FirstOrDefault(i => i.ItemKey == IndirectCostItemKeys.DeveloperProfit)?.Pct,
            IndirectRatesSumPct: cost is null ? null : cost.IndirectRatesSumPct,
            ActualAgeYears: cost?.ActualAgeYears,
            EconomicAgeYears: cost?.EconomicAgeYears,
            LifeExtensionYears: cost?.LifeExtensionYears ?? 0m,
            LifeExtensionBasis: cost?.LifeExtensionBasis,
            ExtendedLifeYears: cost?.ExtendedLifeYears,
            TotalObsolescencePct: cost is null ? null : cost.TotalObsolescencePct,
            FunctionalObsolescencePct: cost?.FunctionalObsolescencePct ?? 0m,
            FunctionalObsolescenceRationale: cost?.FunctionalObsolescenceRationale,
            ExternalObsolescencePct: cost?.ExternalObsolescencePct ?? 0m,
            ExternalObsolescenceRationale: cost?.ExternalObsolescenceRationale,
            Resolutions: resolutions,
            InspectionScopeKey: inspectionScopeKey,
            UninspectedUnitCount: uninspectedUnitCount,
            RemoteInspectionApprovedByAccredited: remoteInspectionApproved,
            MarketApproachRelevant: marketApproachEnabled,
            CostApproachEnabled: costApproachEnabled,
            ComparableDateCutoff: MarketApproachRules.ComparableDateCutoff(
                settings.ValuationDateMode,
                settings.RetrospectiveDate,
                settings.RetrospectiveDateEnd,
                today),
            Today: today,
            ComparableDateCutoffIsPeriodEnd: MarketApproachRules.ComparableDateCutoffIsPeriodEnd(
                settings.ValuationDateMode,
                settings.RetrospectiveDate,
                settings.RetrospectiveDateEnd),
            SubjectPropertyType: typeForRules);

        var alerts = ValuationMethodologyAlertRules.Evaluate(alertInput);
        var overrideByCode = (recon?.MethodologyAlertOverrides ?? [])
            .ToDictionary(o => o.Code, o => o, StringComparer.OrdinalIgnoreCase);
        var hardAlertReasons = alerts
            .Where(a => a.BlocksIssuance)
            .Select(a => a.DetailAr ?? a.LabelAr)
            .ToList();
        var gateBlocks = checks
            .Where(c => c.IsHard && !c.Passed)
            .Select(c => c.DetailAr ?? c.LabelAr)
            .ToList();

        return new ValuationIssuanceGatesDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = propertyId,
            StudyApprovedByReview = studyApprovedByReview,
            ValueAcceptedByReview = valueAcceptedByReview,
            AllowsIssuance = ValuationIssuanceGateRules.AllowsIssuance(checks)
                && !ValuationMethodologyAlertRules.HasBlockingAlerts(alerts),
            Gates = checks.Select(c => new ValuationIssuanceGateItemDto
            {
                Code = c.Code,
                LabelAr = c.LabelAr,
                Passed = c.Passed,
                IsHard = c.IsHard,
                IsWarning = c.IsWarning,
                DetailAr = c.DetailAr,
            }).ToList(),
            BlockingReasonsAr = gateBlocks.Concat(hardAlertReasons).ToList(),
            MethodologyAlerts = alerts.Select(a =>
            {
                overrideByCode.TryGetValue(a.Code, out var ov);
                return new ValuationMethodologyAlertItemDto
                {
                    Number = a.Number,
                    Code = a.Code,
                    LabelAr = a.LabelAr,
                    Triggered = a.Triggered,
                    IsHard = a.IsHard,
                    SeverityKind = a.SeverityKind,
                    Evaluated = a.Evaluated,
                    BlocksIssuance = a.BlocksIssuance,
                    DetailAr = a.DetailAr,
                    OverrideRationale = ov?.OverrideRationale,
                    Acknowledged = ov?.Acknowledged ?? false,
                };
            }).ToList(),
            MethodologyAlertTriggeredCount = ValuationMethodologyAlertRules.TriggeredCount(alerts),
            MethodologyAlertsNoteAr =
                "تنبيهات منهجية (24): 7 حاجبة · 12 بمبرر نصي إلزامي · 5 بإقرار.",
        };
    }

    /// <summary>The case-study facts of the property, or null when Case Study could not be read.</summary>
    /// <remarks>
    /// How it works: one remote read; a failed call (outage, 5xx) comes back as null like an empty answer.
    /// Edge cases + fixed 2026-11-10: a failure used to throw out of the whole evaluation (the draft send
    /// answered 500); now the case-study gates and the review state read as «unknown», which refuses with
    /// «تعذّر التحقق من حالة دراسة الحالة». Cancellation still propagates.
    /// </remarks>
    private async Task<CaseStudyValuationPropertyContextDto?> ReadPropertyContextAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        try
        {
            return await caseStudy.GetValuationPropertyContextAsync(propertyId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return null;
        }
    }

    /// <summary>Whether the saved cost approach still lacks a building age its depreciation needs.</summary>
    /// <remarks>
    /// How it works: loads the stored cost header with its lines and asks the cost domain rule
    /// <see cref="CostDepreciationRules.IsIncomplete(ValuationCostApproach?)"/> (included floor-area lines
    /// with a blank actual or economic age). Edge cases: no saved cost approach → false (nothing to
    /// depreciate yet; the land / final-value gates hold the issue then).
    /// </remarks>
    private async Task<bool> CostDepreciationIncompleteAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken)
    {
        var costRow = await valuation.ValuationCostApproaches.AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        return CostDepreciationRules.IsIncomplete(costRow);
    }
}
