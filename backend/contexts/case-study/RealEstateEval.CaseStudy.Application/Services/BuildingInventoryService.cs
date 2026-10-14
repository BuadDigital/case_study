using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
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

    public async Task<BuildingInventoryWriteAccess> ResolveWriteAccessAsync(
        string poNumber,
        Guid propertyId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        // Staff never needs the task facts, so skip the query for them.
        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return BuildingInventoryWriteAccess.Staff;

        var facts = await db.GetFieldInspectionWriteFactsAsync(poNumber, propertyId, cancellationToken);
        return BuildingInventoryWriteRules.Resolve(
            actor.PrototypeRole, actor.UserId, actor.DistributionAssigneeId, facts);
    }

    public async Task<bool> CanReadAsync(
        string poNumber,
        Guid propertyId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        // Only the field inspector is scoped; skip the query for every other reader.
        if (!string.Equals(
                actor.PrototypeRole?.Trim(),
                BuildingInventoryWriteRules.FieldInspectorRole,
                StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var facts = await db.GetFieldInspectionWriteFactsAsync(poNumber, propertyId, cancellationToken);
        return BuildingInventoryWriteRules.InspectorMayRead(
            actor.PrototypeRole, actor.UserId, actor.DistributionAssigneeId, facts);
    }

    public async Task<(BuildingInventoryDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        string poNumber,
        Guid propertyId,
        SaveBuildingInventoryRequest request,
        BuildingInventoryWriteAccess access,
        CancellationToken cancellationToken,
        PartySubmissionActor? actor = null)
    {
        if (access == BuildingInventoryWriteAccess.Denied)
            return (null, new Dictionary<string, string> { ["_"] = "ليس لديك صلاحية تعديل الحصر" });

        // The inspector's access was decided before this call; re-check the package right here so a
        // submit that landed in between cannot be overwritten by a late save (e.g. a replayed offline write).
        if (access == BuildingInventoryWriteAccess.Inspector
            && (actor is null
                || await ResolveWriteAccessAsync(poNumber, propertyId, actor, cancellationToken)
                    != BuildingInventoryWriteAccess.Inspector))
        {
            return (null, new Dictionary<string, string> { ["_"] = BuildingInventoryWriteRules.PackageSubmitted });
        }

        // «مكونات العقار» text is the specialist's; the inspector writes the table only and any
        // text he sends is ignored (the stored text is kept).
        var writesText = access == BuildingInventoryWriteAccess.Staff;
        var errors = new Dictionary<string, string>();
        // The specialist lists the components whenever they exist; whether they are valued is the
        // appraiser's scope choice (land only / buildings only / land and buildings). The stored
        // answer just records whether any component was listed.
        var lines = request.Lines ?? [];
        var answer = lines.Count > 0 ? HasStructuresToValueValues.Yes : HasStructuresToValueValues.No;

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (!BuildingStructureKinds.IsKnown(line.StructureKind))
                errors[$"lines[{i}].structureKind"] = "نوع الإنشاء غير صالح";
            if (string.IsNullOrWhiteSpace(line.Label))
                errors[$"lines[{i}].label"] = "تسمية البند مطلوبة";
            if ((line.ItemKey?.Trim().Length ?? 0) > 32)
                errors[$"lines[{i}].itemKey"] = "مفتاح البند غير صالح";
            if (!string.IsNullOrWhiteSpace(line.Unit) && !KnownUnits.Contains(line.Unit.Trim()))
                errors[$"lines[{i}].unit"] = "الوحدة غير صالحة";
            if (line.BuildRatioPct is < 0 or > 100)
                errors[$"lines[{i}].buildRatioPct"] = "نسبة البناء بين 0 و 100";
            if (line.RepeatedFloorCount is < 0)
                errors[$"lines[{i}].repeatedFloorCount"] = "عدد الأدوار المتكررة غير صالح";
        }

        if (writesText
            && (request.ComponentsText?.Trim().Length ?? 0) > SpecialistComponentsRules.TextMaxLength)
            errors["componentsText"] = "نص «مكونات العقار» أطول من المسموح";

        if (errors.Count > 0) return (null, errors);

        var prop = await db.GetPropertyWithLinesAsync(
            poNumber,
            propertyId,
            track: true,
            cancellationToken);
        if (prop is null)
            return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });

        prop.HasStructuresToValue = answer;
        if (writesText && request.ComponentsText is not null)
        {
            prop.SpecialistComponentsText = string.IsNullOrWhiteSpace(request.ComponentsText)
                ? null
                : request.ComponentsText.Trim();
        }

        // Upsert in place — re-adding rows with pre-set GUIDs through the tracked
        // navigation makes EF mark them Modified (UPDATE 0 rows → global 409).
        var existingById = prop.BuildingInventoryLines.ToDictionary(l => l.Id);
        var keep = new HashSet<Guid>();
        var now = _time.UtcNow();
        var order = 0;
        foreach (var line in lines)
        {
            var lineId = line.Id is Guid g && g != Guid.Empty ? g : Guid.NewGuid();
            if (existingById.TryGetValue(lineId, out var row))
            {
                var kind = line.StructureKind.Trim();
                var label = line.Label.Trim();
                var area = string.IsNullOrWhiteSpace(line.AreaSqm) ? null : line.AreaSqm.Trim();
                var notes = string.IsNullOrWhiteSpace(line.Notes) ? null : line.Notes.Trim();
                var itemKey = Clean(line.ItemKey);
                var unit = Clean(line.Unit);
                var changed = row.StructureKind != kind || row.Label != label
                    || row.AreaSqm != area || row.Notes != notes
                    || row.ItemKey != itemKey || row.Unit != unit
                    || row.BuildRatioPct != line.BuildRatioPct
                    || row.RepeatedFloorCount != line.RepeatedFloorCount;
                row.SortOrder = order++;
                row.StructureKind = kind;
                row.Label = label;
                row.AreaSqm = area;
                row.Notes = notes;
                row.ItemKey = itemKey;
                row.Unit = unit;
                row.BuildRatioPct = line.BuildRatioPct;
                row.RepeatedFloorCount = line.RepeatedFloorCount;
                row.UpdatedAtUtc = now;
                if (changed && HasIdentity(actor))
                {
                    row.ProvenanceJson = PartyFieldProvenance.SerializeSingle(
                        PartyFieldProvenance.ApplyChange(
                            PartyFieldProvenance.ParseSingle(row.ProvenanceJson),
                            previouslyEmpty: false,
                            actor!,
                            now.ToString("O")));
                }
            }
            else
            {
                db.AddLine(new BuildingInventoryLine
                {
                    ProvenanceJson = HasIdentity(actor)
                        ? PartyFieldProvenance.SerializeSingle(PartyFieldProvenance.NewEntryFor(actor!, now))
                        : "{}",
                    Id = lineId,
                    PropertyId = prop.Id,
                    SortOrder = order++,
                    StructureKind = line.StructureKind.Trim(),
                    Label = line.Label.Trim(),
                    AreaSqm = string.IsNullOrWhiteSpace(line.AreaSqm) ? null : line.AreaSqm.Trim(),
                    Notes = string.IsNullOrWhiteSpace(line.Notes) ? null : line.Notes.Trim(),
                    ItemKey = Clean(line.ItemKey),
                    Unit = Clean(line.Unit),
                    BuildRatioPct = line.BuildRatioPct,
                    RepeatedFloorCount = line.RepeatedFloorCount,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
            }
            keep.Add(lineId);
        }
        db.RemoveLines(
            prop.BuildingInventoryLines.Where(l => !keep.Contains(l.Id)).ToList());

        await db.SaveChangesAsync(cancellationToken);

        var fresh = await db.GetSavedPropertyWithLinesAsync(propertyId, cancellationToken);
        return (ToDto(fresh), null);
    }

    private static readonly HashSet<string> KnownUnits = new(StringComparer.Ordinal) { "sqm", "lm", "count", "lump" };

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool HasIdentity(PartySubmissionActor? actor) =>
        actor is not null
        && (!string.IsNullOrWhiteSpace(actor.UserId) || !string.IsNullOrWhiteSpace(actor.DisplayName));

    private static BuildingInventoryDto ToDto(WorkOrderProperty prop) => new()
    {
        PropertyId = prop.Id,
        HasStructuresToValue = prop.HasStructuresToValue ?? "",
        ComponentsText = prop.SpecialistComponentsText ?? "",
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
                ItemKey = l.ItemKey,
                Unit = l.Unit,
                BuildRatioPct = l.BuildRatioPct,
                RepeatedFloorCount = l.RepeatedFloorCount,
                Provenance = PartyFieldProvenance.ParseSingle(l.ProvenanceJson),
            })
            .ToList(),
    };
}
