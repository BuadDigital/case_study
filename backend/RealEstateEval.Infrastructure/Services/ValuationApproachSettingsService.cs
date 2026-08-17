using Microsoft.EntityFrameworkCore;
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
    CaseStudyDbContext caseStudy)
    : IValuationApproachSettingsService
{
    public async Task<ValuationApproachSettingsDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var row = await db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

        return ToDto(vr, row, await HasStructuresToValueAsync(vr, cancellationToken));
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

        var hasStructures = await HasStructuresToValueAsync(vr, cancellationToken);
        var errors = ValuationApproachSettingsRules.Validate(
            request.MarketApproachEnabled,
            request.CostApproachEnabled,
            request.IncomeApproachEnabled,
            request.CostBasisKey,
            request.CostMeasurementUnitKey,
            vr.PropertyType,
            hasStructures);
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
        row.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return (ToDto(vr, row, hasStructures), null);
    }

 /// <summary>سؤال الحصر «هل توجد مبانٍ/إنشاءات يجب تقييمها؟» من عقار أمر العمل.</summary>
    private async Task<bool> HasStructuresToValueAsync(
        ValuationRequest vr,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(vr.PropertyId?.Trim(), out var propertyGuid)) return false;
        var answer = await caseStudy.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == propertyGuid)
            .Select(p => p.HasStructuresToValue)
            .FirstOrDefaultAsync(cancellationToken);
        return string.Equals(answer?.Trim(), "yes", StringComparison.OrdinalIgnoreCase);
    }

    private static ValuationApproachSettingsDto ToDto(
        ValuationRequest vr,
        ValuationApproachSettings? row,
        bool hasStructures)
    {
        var effective = row
            ?? ValuationApproachSettingsRules.Defaults(vr.Id, vr.PropertyType, hasStructures);
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
            IsSaved = row is not null,
        };
    }
}
