using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Governing screen 1: applied approaches (Q-2/Q-3 amended) + cost basis/unit + adjustments unlock.
/// Absent row = property-type defaults, so older valuations keep behaving as before.
/// </summary>
public sealed class ValuationApproachSettingsService(
    ValuationDbContext db,
    ICaseStudyLookup caseStudy,
    IOrganizationSettingsService organizationSettings,
    IValuationListsService valuationLists,
    TimeProvider? time = null)
    : IValuationApproachSettingsService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<ValuationApproachSettingsDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var row = await db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

        var (hasStructures, assignmentType, effectivePropertyType) =
            await PropertyContextAsync(vr, cancellationToken);
        return ToDto(
            vr,
            row,
            hasStructures,
            effectivePropertyType,
            assignmentType,
            await AssumptionLibraryAsync(cancellationToken));
    }

 /// <summary>Assumptions library — managed in valuation-report tab settings (decision 25 layer B).</summary>
    private async Task<HashSet<string>> AllowedPurposeKeysAsync(CancellationToken cancellationToken)
    {
        var allowed = new HashSet<string>(ValuationPurposeKeys.All, StringComparer.OrdinalIgnoreCase);
        try
        {
            var catalog = await valuationLists.GetAsync(cancellationToken);
            if (catalog.Lists.TryGetValue(ValuationListIds.Purposes, out var rows))
            {
                foreach (var row in rows.Where(x => x.IsEnabled))
                    allowed.Add(row.Key);
            }
        }
        catch
        {
            // Fall back to built-in keys when Platform catalog is unreachable.
        }

        return allowed;
    }

    private async Task<IReadOnlyList<string>> AssumptionLibraryAsync(
        CancellationToken cancellationToken)
    {
        var org = await organizationSettings.GetInternalAsync(cancellationToken);
        return org.ValuationReport.SpecialAssumptionLibrary;
    }

    public async Task<(ValuationApproachSettingsDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationApproachSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل" });
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        var frozenMessage = await ValuationReportFreeze.GetFrozenMessageAsync(
            db, caseStudy, vr.Id, vr.PropertyId, cancellationToken);
        if (frozenMessage is not null)
            return (null, new Dictionary<string, string> { ["_"] = frozenMessage });

        var (hasStructures, assignmentType, effectivePropertyType) =
            await PropertyContextAsync(vr, cancellationToken);
        DateOnly? retroDate = null;
        if (DateOnly.TryParse(request.RetrospectiveDate?.Trim(), out var parsedRetro))
            retroDate = parsedRetro;
        DateOnly? retroDateEnd = null;
        if (DateOnly.TryParse(request.RetrospectiveDateEnd?.Trim(), out var parsedRetroEnd))
            retroDateEnd = parsedRetroEnd;

        var row = await db.ValuationApproachSettings
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        // A client that does not send a field (JSON null) keeps the stored value: the final-review
        // assumptions save and older screens neither wipe the rationale nor reset the interest valued.
        var retroRationale = request.RetrospectiveRationale ?? row?.RetrospectiveRationale;
        var interestKey = request.OwnershipInterestKey ?? row?.OwnershipInterestKey;
        var leaseYears = request.OwnershipInterestKey is null ? row?.RemainingLeaseYears : request.RemainingLeaseYears;

        var errors = ValuationApproachSettingsRules.Validate(
            request.MarketApproachEnabled,
            request.CostApproachEnabled,
            request.IncomeApproachEnabled,
            request.CostBasisKey,
            request.CostMeasurementUnitKey,
            effectivePropertyType,
            hasStructures,
            request.ValuationPurposeKey,
            request.ValuationPurposeNote,
            request.ExternalSpecialistUsed,
            request.ExternalSpecialistDetails,
            request.ValuationDateMode,
            retroDate,
            await AllowedPurposeKeysAsync(cancellationToken),
            costScopeKey: request.CostScopeKey,
            retrospectiveDateEnd: retroDateEnd,
            retrospectiveRationale: retroRationale,
            today: RiyadhClock.Today(_time),
            reportDate: await CurrentReportDateAsync(valuationRequestId, cancellationToken),
            ownershipInterestKey: interestKey,
            remainingLeaseYears: leaseYears);
        if (errors.Count > 0) return (null, errors);

        if (row is null)
        {
            row = new ValuationApproachSettings
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
            };
            db.ValuationApproachSettings.Add(row);
        }

        row.MarketApproachEnabled = request.MarketApproachEnabled;
        row.CostApproachEnabled = request.CostApproachEnabled;
        // D17: the income approach may be enabled (its inputs and value come with the income screen).
        row.IncomeApproachEnabled = request.IncomeApproachEnabled;
        var interest = OwnershipInterestKeys.Normalize(interestKey);
        row.OwnershipInterestKey = interest;
        row.RemainingLeaseYears = OwnershipInterestKeys.IsLeasehold(interest) ? leaseYears : null;
        row.CostBasisKey = CostBasisKeys.Normalize(request.CostBasisKey);
        row.CostScopeKey = CostScopeKeys.Normalize(request.CostScopeKey);
        row.CostMeasurementUnitKey = CostMeasurementUnitKeys.Normalize(request.CostMeasurementUnitKey);
        row.AdjustmentsEditUnlocked = request.AdjustmentsEditUnlocked;
        row.ValuationPurposeKey = (request.ValuationPurposeKey ?? "").Trim().ToLowerInvariant();
        row.ValuationPurposeNote = string.IsNullOrWhiteSpace(request.ValuationPurposeNote)
            ? null
            : request.ValuationPurposeNote.Trim();
        row.ExternalSpecialistUsed = request.ExternalSpecialistUsed;
        row.ExternalSpecialistDetails = request.ExternalSpecialistUsed
            ? request.ExternalSpecialistDetails!.Trim()
            : null;
        var dateMode = ValuationDateModes.Normalize(request.ValuationDateMode);
        row.ValuationDateMode = dateMode;
        row.RetrospectiveDate = dateMode == ValuationDateModes.Retrospective ? retroDate : null;
        row.RetrospectiveDateEnd =
            dateMode == ValuationDateModes.Retrospective ? retroDateEnd : null;
        row.RetrospectiveRationale = dateMode == ValuationDateModes.Retrospective
            && !string.IsNullOrWhiteSpace(retroRationale)
            ? retroRationale.Trim()
            : null;
        var selectedAssumptions = request.SelectedAssumptions ?? [];
        if (request.ExternalSpecialistUsed)
            selectedAssumptions = ValuationApproachSettingsRules.WithoutNoExternalSpecialistAssumptions(
                selectedAssumptions);
        row.SelectedAssumptionsJson = ValuationApproachSettingsRules.SerializeAssumptions(
            selectedAssumptions);
        row.UpdatedAtUtc = _time.UtcNow();

        await db.SaveChangesAsync(cancellationToken);
        return (ToDto(
            vr,
            row,
            hasStructures,
            effectivePropertyType,
            assignmentType,
            await AssumptionLibraryAsync(cancellationToken)), null);
    }

 /// <summary>D9: the report date of the current draft once set (approval), else null.</summary>
    private async Task<DateOnly?> CurrentReportDateAsync(Guid valuationRequestId, CancellationToken cancellationToken)
    {
        var reportDate = await db.ValuationReportDrafts.AsNoTracking()
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .OrderByDescending(x => x.Version)
            .Select(x => x.ReportDate)
            .FirstOrDefaultAsync(cancellationToken);
        return DateOnly.TryParseExact(reportDate?.Trim(), "yyyy-MM-dd", out var parsed) ? parsed : null;
    }

 /// <summary>Scoping question "are there buildings/structures to value?" + assignment type from the work-order property.</summary>
    private async Task<(bool HasStructures, AssignmentType AssignmentType, string EffectivePropertyType)> PropertyContextAsync(
        ValuationRequest vr,
        CancellationToken cancellationToken)
    {
        var propertyGuid = vr.PropertyId;
        if (propertyGuid == Guid.Empty)
            return (false, AssignmentType.Execution, vr.PropertyType);
        var context = await caseStudy.GetValuationPropertyContextAsync(propertyGuid, cancellationToken);
        return (
            context?.HasStructures() ?? false,
            context?.AssignmentTypeValue() ?? AssignmentType.Execution,
            context?.EffectivePropertyType() ?? vr.PropertyType);
    }

    private static ValuationApproachSettingsDto ToDto(
        ValuationRequest vr,
        ValuationApproachSettings? row,
        bool hasStructures,
        string effectivePropertyType,
        AssignmentType assignmentType,
        IReadOnlyList<string> assumptionLibrary)
    {
        var effective = row
            ?? ValuationApproachSettingsRules.Defaults(vr.Id, effectivePropertyType, hasStructures);
        var purposeKey = string.IsNullOrWhiteSpace(effective.ValuationPurposeKey)
            ? AssignmentValuationDefaults.PurposeKey(assignmentType)
            : effective.ValuationPurposeKey;
        var costAllowed = ValuationApproachSettingsRules.CanEnableCostApproach(
            effectivePropertyType,
            hasStructures);
        return new ValuationApproachSettingsDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = vr.PropertyId.ToString("D"),
            PropertyType = effectivePropertyType,
            InitialPropertyType = vr.PropertyType,
            IsLandPropertyType = ValuationApproachSettingsRules.IsLandPropertyType(effectivePropertyType),
            HasStructuresToValue = hasStructures,
            CostApproachAllowed = costAllowed,
            MarketApproachEnabled = effective.MarketApproachEnabled,
            // «أرض فقط» keeps the cost approach off whatever the stored toggle says.
            CostApproachEnabled = costAllowed
                && effective.CostApproachEnabled
                && CostScopeKeys.IncludesBuildings(effective.CostScopeKey),
            IncomeApproachEnabled = effective.IncomeApproachEnabled,
            OwnershipInterestKey = OwnershipInterestKeys.Normalize(effective.OwnershipInterestKey),
            OwnershipInterestLabelAr = OwnershipInterestKeys.LabelAr(effective.OwnershipInterestKey),
            RemainingLeaseYears = OwnershipInterestKeys.IsLeasehold(effective.OwnershipInterestKey)
                ? effective.RemainingLeaseYears
                : null,
            CostBasisKey = effective.CostBasisKey,
            CostBasisLabelAr = CostBasisKeys.LabelAr(effective.CostBasisKey),
            CostScopeKey = CostScopeKeys.Normalize(effective.CostScopeKey),
            CostScopeLabelAr = CostScopeKeys.LabelAr(effective.CostScopeKey),
            CostMeasurementUnitKey = effective.CostMeasurementUnitKey,
            CostMeasurementUnitLabelAr = CostMeasurementUnitKeys.LabelAr(effective.CostMeasurementUnitKey),
            AdjustmentsEditUnlocked = effective.AdjustmentsEditUnlocked,
            ValuationPurposeKey = purposeKey,
            ValuationPurposeLabelAr = ValuationPurposeKeys.LabelAr(purposeKey),
            ValuationPurposeNote = effective.ValuationPurposeNote,
            ExternalSpecialistUsed = effective.ExternalSpecialistUsed,
            ExternalSpecialistDetails = effective.ExternalSpecialistDetails,
            ValuationDateMode = effective.ValuationDateMode,
            ValuationDateModeLabelAr = ValuationDateModes.LabelAr(effective.ValuationDateMode),
            RetrospectiveDate = effective.RetrospectiveDate?.ToString("yyyy-MM-dd"),
            RetrospectiveDateEnd = effective.RetrospectiveDateEnd?.ToString("yyyy-MM-dd"),
            RetrospectiveRationale = effective.RetrospectiveRationale,
            SelectedAssumptions = ValuationApproachSettingsRules.ParseAssumptions(
                effective.SelectedAssumptionsJson),
            AssumptionLibrary = assumptionLibrary,
            IsSaved = row is not null,
        };
    }
}
