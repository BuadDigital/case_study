using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// شاشة 1 الحاكمة: الأساليب المطبَّقة (ق-2/ق-3 المعدَّل) + أساس ووحدة التكلفة + صلاحية التسويات.
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

        var (hasStructures, assignmentType) = await PropertyContextAsync(vr, cancellationToken);
        return ToDto(
            vr,
            row,
            hasStructures,
            assignmentType,
            await AssumptionLibraryAsync(cancellationToken));
    }

 /// <summary>مكتبة الافتراضات — تُدار في إعدادات تبويب تقرير التقييم (القرار 25 طبقة ب).</summary>
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

        var (hasStructures, assignmentType) = await PropertyContextAsync(vr, cancellationToken);
        DateOnly? retroDate = null;
        if (DateOnly.TryParse(request.RetrospectiveDate?.Trim(), out var parsedRetro))
            retroDate = parsedRetro;

        var errors = ValuationApproachSettingsRules.Validate(
            request.MarketApproachEnabled,
            request.CostApproachEnabled,
            request.IncomeApproachEnabled,
            request.CostBasisKey,
            request.CostMeasurementUnitKey,
            vr.PropertyType,
            hasStructures,
            request.ValuationPurposeKey,
            request.ValuationPurposeNote,
            request.ExternalSpecialistUsed,
            request.ExternalSpecialistDetails,
            request.ValuationDateMode,
            retroDate,
            request.RetrospectiveRationale,
            await AllowedPurposeKeysAsync(cancellationToken));
        if (errors.Count > 0) return (null, errors);

        var row = await db.ValuationApproachSettings
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
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
        row.IncomeApproachEnabled = false;
        row.CostBasisKey = CostBasisKeys.Normalize(request.CostBasisKey);
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
        row.RetrospectiveRationale = dateMode == ValuationDateModes.Retrospective
            ? request.RetrospectiveRationale!.Trim()
            : null;
        row.SelectedAssumptionsJson = ValuationApproachSettingsRules.SerializeAssumptions(
            request.SelectedAssumptions ?? []);
        row.UpdatedAtUtc = _time.UtcNow();

        await db.SaveChangesAsync(cancellationToken);
        return (ToDto(vr, row, hasStructures, assignmentType, await AssumptionLibraryAsync(cancellationToken)), null);
    }

 /// <summary>سؤال الحصر «هل توجد مبانٍ/إنشاءات يجب تقييمها؟» + نوع الإسناد من عقار أمر العمل.</summary>
    private async Task<(bool HasStructures, AssignmentType AssignmentType)> PropertyContextAsync(
        ValuationRequest vr,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(vr.PropertyId?.Trim(), out var propertyGuid))
            return (false, AssignmentType.Execution);
        var context = await caseStudy.GetValuationPropertyContextAsync(propertyGuid, cancellationToken);
        var hasStructures = string.Equals(
            context?.HasStructuresToValue.Trim(),
            "yes",
            StringComparison.OrdinalIgnoreCase);
        return (hasStructures, context?.AssignmentTypeValue() ?? AssignmentType.Execution);
    }

    private static ValuationApproachSettingsDto ToDto(
        ValuationRequest vr,
        ValuationApproachSettings? row,
        bool hasStructures,
        AssignmentType assignmentType,
        IReadOnlyList<string> assumptionLibrary)
    {
        var effective = row
            ?? ValuationApproachSettingsRules.Defaults(vr.Id, vr.PropertyType, hasStructures);
        var purposeKey = string.IsNullOrWhiteSpace(effective.ValuationPurposeKey)
            ? AssignmentValuationDefaults.PurposeKey(assignmentType)
            : effective.ValuationPurposeKey;
        return new ValuationApproachSettingsDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = vr.PropertyId,
            PropertyType = vr.PropertyType,
            IsLandPropertyType = ValuationApproachSettingsRules.IsLandPropertyType(vr.PropertyType),
            HasStructuresToValue = hasStructures,
            CostApproachAllowed = ValuationApproachSettingsRules.CanEnableCostApproach(
                vr.PropertyType, hasStructures),
            MarketApproachEnabled = effective.MarketApproachEnabled,
            CostApproachEnabled = effective.CostApproachEnabled,
            IncomeApproachEnabled = effective.IncomeApproachEnabled,
            CostBasisKey = effective.CostBasisKey,
            CostBasisLabelAr = CostBasisKeys.LabelAr(effective.CostBasisKey),
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
            RetrospectiveRationale = effective.RetrospectiveRationale,
            SelectedAssumptions = ValuationApproachSettingsRules.ParseAssumptions(
                effective.SelectedAssumptionsJson),
            AssumptionLibrary = assumptionLibrary,
            IsSaved = row is not null,
        };
    }
}
