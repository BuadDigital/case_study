using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public class BuildingInventoryService(CaseStudyDbContext db) : IBuildingInventoryService
{
    public async Task<BuildingInventoryDto?> GetAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var po = IWorkOrderLoader.NormalizePo(poNumber);
        var prop = await db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.WorkOrder)
            .Include(p => p.BuildingInventoryLines)
            .FirstOrDefaultAsync(
                p => p.Id == propertyId && p.WorkOrder!.PoNumber == po,
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

        var po = IWorkOrderLoader.NormalizePo(poNumber);
        var prop = await db.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .Include(p => p.BuildingInventoryLines)
            .FirstOrDefaultAsync(
                p => p.Id == propertyId && p.WorkOrder!.PoNumber == po,
                cancellationToken);
        if (prop is null)
            return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });

        prop.HasStructuresToValue = answer;

        db.BuildingInventoryLines.RemoveRange(prop.BuildingInventoryLines);
        prop.BuildingInventoryLines.Clear();

        var now = DateTime.UtcNow;
        if (answer == HasStructuresToValueValues.Yes)
        {
            var order = 0;
            foreach (var line in lines)
            {
                prop.BuildingInventoryLines.Add(new BuildingInventoryLine
                {
                    Id = line.Id is Guid g && g != Guid.Empty ? g : Guid.NewGuid(),
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
        }

        await db.SaveChangesAsync(cancellationToken);

        var fresh = await db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.BuildingInventoryLines)
            .FirstAsync(p => p.Id == propertyId, cancellationToken);
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
