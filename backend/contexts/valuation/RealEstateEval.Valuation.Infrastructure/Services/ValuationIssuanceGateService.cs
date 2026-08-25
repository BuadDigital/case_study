using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Aggregates credential + case-study match + gates + methodology alerts.
/// </summary>
public sealed class ValuationIssuanceGateService(
    ValuationDbContext valuation,
    ICaseStudyLookup caseStudy,
    IAttachmentLookup attachments,
    IOrganizationSettingsService organizationSettings,
    IAttachmentPrintDictionaryService printDictionary,
    IValuationComparableSelectionService selections,
    IValuationCostApproachService costApproach,
    IValuationReconciliationService reconciliation,
    TimeProvider clock) : IValuationIssuanceGateService
{
    public async Task<ValuationIssuanceGatesDto?> EvaluateAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await valuation.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var org = await organizationSettings.GetInternalAsync(cancellationToken);
        var eval = org.Evaluator;

        var propertyId = vr.PropertyId?.Trim() ?? "";
        DeedKind deedKind = DeedKind.Traditional;
        string matchOutcome = DeedNatureMatchOutcomes.Unset;
        var hasStructures = false;
        var propertyType = "";
 // حدود المعاينة (القرار 24 + ق-7) — تغذي m18/m21.
        string? inspectionScopeKey = null;
        var uninspectedUnitCount = 0;
        string? inspectionRestrictionReason = null;
        var remoteInspectionApproved = false;

        if (Guid.TryParse(propertyId, out var propertyGuid))
        {
            var context = await caseStudy.GetValuationPropertyContextAsync(
                propertyGuid,
                cancellationToken);
            if (context is not null)
            {
                deedKind = context.DeedKindValue();
                propertyType = context.PropertyType.Trim();
                hasStructures = string.Equals(
                    context.HasStructuresToValue.Trim(),
                    "yes",
                    StringComparison.OrdinalIgnoreCase);
                inspectionScopeKey = string.IsNullOrWhiteSpace(context.InspectionScopeKey)
                    ? null
                    : context.InspectionScopeKey;
                uninspectedUnitCount = InspectionLimitsRules.TotalUninspectedUnits(
                    InspectionLimitsRules.ParseUnits(context.UninspectedUnitsJson));
                inspectionRestrictionReason = context.InspectionRestrictionReason;
                remoteInspectionApproved = context.RemoteInspectionApprovedAtUtc is not null;
                matchOutcome = context.DeedNatureMatchOutcome ?? "";
            }
        }

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var cost = await costApproach.GetAsync(valuationRequestId, cancellationToken);
        var recon = await reconciliation.GetAsync(valuationRequestId, cancellationToken);
        var hasReconSaved = !string.IsNullOrWhiteSpace(recon?.MethodsRationale)
            || (recon?.FinalOpinionValue ?? 0m) > 0m;

        var costUsed = (cost?.CostOpinionWithLand ?? 0m) > 0m
            || (cost?.Lines.Count ?? 0) > 0;

 // ق-2/ق-3 المعدَّل: cost alerts are irrelevant when the approach is off
 // (bare land defaults it off; land with structures keeps it available).
        var approachSettings = await valuation.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        var costApproachEnabled = approachSettings?.CostApproachEnabled
            ?? ValuationApproachSettingsRules.CanEnableCostApproach(vr.PropertyType, hasStructures);

        var checks = new List<ValuationIssuanceGateCheck>
        {
            ValuationIssuanceGateRules.Credentials(
                eval.LicenseExpiresAt,
                eval.MembershipExpiresAt,
                today),
            ValuationIssuanceGateRules.ParticipantCredentials(
                org.Valuers
                    .Where(v => v.IsActive)
                    .Select(v => new ValuationIssuanceGateRules.RosterParticipantCredentials(
                        v.NameAr,
                        v.LicenseExpiresAt,
                        v.MembershipExpiresAt))
                    .ToList(),
                today),
            ValuationIssuanceGateRules.DeedNatureMatch(deedKind, matchOutcome),
            ValuationIssuanceGateRules.MinAdoptedComparables(market?.AdoptedCount ?? 0),
            ValuationIssuanceGateRules.ComparableWeights(
                market?.WeightsSumTo100 ?? true,
                market?.AdoptedCount ?? 0),
            ValuationIssuanceGateRules.ReconciliationWeights(
                hasReconSaved,
                recon?.WeightsSumTo100 ?? false),
            ValuationIssuanceGateRules.FinalOpinion(recon?.FinalOpinionValue ?? 0m),
            ValuationIssuanceGateRules.RequiredAttachments(
                await FindMissingRequiredAttachmentLabelsAsync(propertyId, propertyType, cancellationToken)),
        };

        var resolutions = (recon?.MethodologyAlertOverrides ?? [])
            .Select(o => new ValuationMethodologyAlertResolution(
                o.Code,
                o.OverrideRationale,
                o.Acknowledged))
            .ToList();

 // القرار 24: سبب التقييد المنظّم هو شرح المقيّم لقيود المعاينة —
 // يفي بمبرر m18 دون إعادة كتابته في بوابات الإصدار (المصدر الواحد).
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
                .Select(i => new ValuationMethodologyAlertComparableInput(
                    i.Comparable.ComparablePropertyType,
                    i.Market?.ExceedsLargeAdjustmentThreshold ?? false,
                    i.Market?.SumIncludedPct ?? 0m,
                    DealAgeMonths: i.Market?.DealAgeMonths ?? 0,
                    HasMarketConditionsAdjustment: (i.Market?.AdjustmentLines ?? [])
                        .Any(l => l.FactorKey == MarketAdjustmentFactorKeys.Market
                                  && l.IsIncluded
                                  && l.Percent != 0m)))
                .ToList(),
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
            TimeGapMonthsThreshold: org.Valuation.ComparableTimeGapMonths);

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
                "تنبيهات منهجية (21): 7 حاجبة · 8 بمبرر نصي إلزامي · 6 بإقرار.",
        };
    }

 /// <summary>
 /// For every active dictionary type marked required (and matching the property
 /// type, when linked), at least one upload whose scope maps to that type must exist.
 /// </summary>
    private async Task<IReadOnlyList<string>> FindMissingRequiredAttachmentLabelsAsync(
        string propertyId,
        string propertyType,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return [];

        var dictionary = await printDictionary.GetAsync(cancellationToken);
        var required = dictionary.Types
            .Where(t => t.IsActive && t.IsRequired)
            .Where(t => t.PropertyTypeKeys.Count == 0
                || t.PropertyTypeKeys.Any(k =>
                    string.Equals(k?.Trim(), propertyType, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        if (required.Count == 0) return [];

        var presentKeys = (await attachments.ListForPropertyAsync(propertyId, actor: null, cancellationToken))
            .Select(a => AttachmentPrintRules.TypeKeyFromScope(a.Scope))
            .Where(k => !string.IsNullOrWhiteSpace(k))
            .Select(k => k!.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.Ordinal);

        return required
            .Where(t => !presentKeys.Contains(t.Key.Trim().ToLowerInvariant()))
            .Select(t => t.LabelAr)
            .ToList();
    }
}
