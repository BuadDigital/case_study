using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public class BuildingInventoryService(IBuildingInventoryRepository db,
    TimeProvider? time = null) : IBuildingInventoryService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<BuildingInventoryDto?> GetAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var prop = await db.GetPropertyWithLinesAsync(
            poNumber,
            propertyId,
            track: false,
            cancellationToken);
        return prop is null ? null : ToDto(prop);
    }

    public async Task<(BuildingInventoryDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        string poNumber,
        Guid propertyId,
        SaveBuildingInventoryRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string>();
        if (!HasStructuresToValueValues.IsKnown(request.HasStructuresToValue))
            errors["hasStructuresToValue"] = "قيمة «هل توجد إنشاءات» غير صالحة";

        var answer = (request.HasStructuresToValue ?? "").Trim();
        var lines = request.Lines ?? [];

        if (answer == HasStructuresToValueValues.Yes && lines.Count == 0)
            errors["lines"] = "أضف بند إنشاء واحد على الأقل عند الإجابة بنعم";

        if (answer == HasStructuresToValueValues.No && lines.Count > 0)
            errors["lines"] = "عند «لا» لا تُحفظ بنود إنشاء — احذفها أو غيّر الإجابة";

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (!BuildingStructureKinds.IsKnown(line.StructureKind))
                errors[$"lines[{i}].structureKind"] = "نوع الإنشاء غير صالح";
            if (string.IsNullOrWhiteSpace(line.Label))
                errors[$"lines[{i}].label"] = "تسمية البند مطلوبة";
        }

        if (errors.Count > 0) return (null, errors);

        var prop = await db.GetPropertyWithLinesAsync(
            poNumber,
            propertyId,
            track: true,
            cancellationToken);
        if (prop is null)
            return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });

        prop.HasStructuresToValue = answer;

        // Upsert in place — re-adding rows with pre-set GUIDs through the tracked
        // navigation makes EF mark them Modified (UPDATE 0 rows → global 409).
        var existingById = prop.BuildingInventoryLines.ToDictionary(l => l.Id);
        var keep = new HashSet<Guid>();
        var now = _time.UtcNow();
        if (answer == HasStructuresToValueValues.Yes)
        {
            var order = 0;
            foreach (var line in lines)
            {
                var lineId = line.Id is Guid g && g != Guid.Empty ? g : Guid.NewGuid();
                if (existingById.TryGetValue(lineId, out var row))
                {
                    row.SortOrder = order++;
                    row.StructureKind = line.StructureKind.Trim();
                    row.Label = line.Label.Trim();
                    row.AreaSqm = string.IsNullOrWhiteSpace(line.AreaSqm) ? null : line.AreaSqm.Trim();
                    row.Notes = string.IsNullOrWhiteSpace(line.Notes) ? null : line.Notes.Trim();
                    row.UpdatedAtUtc = now;
                }
                else
                {
                    db.AddLine(new BuildingInventoryLine
                    {
                        Id = lineId,
                        PropertyId = prop.Id,
                        SortOrder = order++,
                        StructureKind = line.StructureKind.Trim(),
                        Label = line.Label.Trim(),
                        AreaSqm = string.IsNullOrWhiteSpace(line.AreaSqm) ? null : line.AreaSqm.Trim(),
                        Notes = string.IsNullOrWhiteSpace(line.Notes) ? null : line.Notes.Trim(),
                        CreatedAtUtc = now,
                        UpdatedAtUtc = now,
                    });
                }
                keep.Add(lineId);
            }
        }
        db.RemoveLines(
            prop.BuildingInventoryLines.Where(l => !keep.Contains(l.Id)).ToList());

        await db.SaveChangesAsync(cancellationToken);

        var fresh = await db.GetSavedPropertyWithLinesAsync(propertyId, cancellationToken);
        return (ToDto(fresh), null);
    }

    private static BuildingInventoryDto ToDto(WorkOrderProperty prop) => new()
    {
        PropertyId = prop.Id,
        HasStructuresToValue = prop.HasStructuresToValue ?? "",
        Lines = prop.BuildingInventoryLines
            .OrderBy(l => l.SortOrder)
            .Select(l => new BuildingInventoryLineDto
            {
                Id = l.Id,
                SortOrder = l.SortOrder,
                StructureKind = l.StructureKind,
                Label = l.Label,
                AreaSqm = l.AreaSqm,
                Notes = l.Notes,
            })
            .ToList(),
    };
}
