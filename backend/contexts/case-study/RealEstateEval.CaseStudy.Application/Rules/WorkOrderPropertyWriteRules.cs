using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Write-side rules for a work-order property: which edits are allowed, how a submitted DTO or
/// bourse request lands on the entity, and the normalisations the columns expect. Pure — the
/// command service keeps the loads, the SaveChanges and the failure/timeline side effects.
/// </summary>
public static class WorkOrderPropertyWriteRules
{
    public const int SpecialistReportExtrasMaxLength = 64_000;

    public static Dictionary<string, string> WorkOrderNotFound() =>
        new() { ["_"] = "أمر العمل غير موجود" };

    public static Dictionary<string, string> PropertyNotFound() =>
        new() { ["_"] = "العقار غير موجود" };

    public static Dictionary<string, string> PropertyRemoved() =>
        new() { ["_"] = "لا يمكن تعديل عقار محذوف" };

    /// <summary>
    /// A property may only be edited when it exists on the order and has not been removed.
    /// Returns the error dictionary to hand back, or null with <paramref name="property"/> set.
    /// </summary>
    public static Dictionary<string, string>? FindEditableProperty(
        WorkOrder workOrder,
        Guid propertyId,
        out WorkOrderProperty? property)
    {
        property = workOrder.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (property is null) return PropertyNotFound();
        if (property.IsRemoved)
        {
            property = null;
            return PropertyRemoved();
        }

        return null;
    }

    /// <summary>Two validators over the same payload; first message per field wins.</summary>
    public static Dictionary<string, string> MergeErrors(
        IEnumerable<KeyValuePair<string, string>> first,
        IEnumerable<KeyValuePair<string, string>> second) =>
        first.Concat(second)
            .GroupBy(kv => kv.Key)
            .ToDictionary(g => g.Key, g => g.First().Value);

    /// <summary>
    /// The duplicate-deed probe both property validators need, over the loaded order. Deeds are
    /// compared normalised (DeedNumberRules): "123456", "123-456" and "١٢٣٤٥٦" are one deed.
    /// </summary>
    public static Func<string, Guid?, bool> DeedTakenProbe(WorkOrder workOrder) =>
        (deed, excludeId) => workOrder.Properties.Any(p =>
            !p.IsRemoved
            && DeedNumberRules.EqualsNormalized(p.DeedNumber, deed)
            && (excludeId is null || p.Id != excludeId));

    /// <summary>Removal always needs a short, stated reason.</summary>
    public static (string? Error, string Reason) ValidateDeleteReason(string? reason)
    {
        var trimmed = (reason ?? "").Trim();
        if (trimmed.Length == 0) return ("سبب الحذف مطلوب", "");
        return trimmed.Length > 500 ? ("سبب الحذف طويل جداً", "") : (null, trimmed);
    }

    /// <summary>Removing a property shrinks the expected count, never below one.</summary>
    public static int ExpectedCountAfterRemoval(int expectedPropertyCount) =>
        Math.Max(1, expectedPropertyCount - 1);


    /// <summary>
    /// Validates the specialist-report wire bag and applies it to first-class columns
    /// (see <see cref="SpecialistReportExtrasRules"/>). Empty / literal null clears the columns.
    /// </summary>
    public static (Dictionary<string, string>? Errors, string? Value) ValidateSpecialistReportExtras(
        string? specialistReportExtrasJson)
    {
        // Probe on a throwaway entity so callers that only need validation stay pure.
        var probe = new WorkOrderProperty();
        var errors = SpecialistReportExtrasRules.ApplyFromWireJson(probe, specialistReportExtrasJson);
        if (errors is not null) return (errors, null);
        return (null, probe.SpecialistReportExtrasJson);
    }

    /// <summary>Concurrency on a property save is reported with the entity kinds that clashed.</summary>
    public static Dictionary<string, string> ConcurrencyErrors(string entityKinds) =>
        new()
        {
            ["_"] = string.IsNullOrEmpty(entityKinds)
                ? "تعذّر حفظ العقار — أعد تحميل الصفحة وحاول مرة أخرى"
                : $"تعذّر حفظ العقار ({entityKinds}) — أعد تحميل الصفحة وحاول مرة أخرى",
        };

    /// <summary>Timeline subtitle for the bourse step: city then district, blanks dropped.</summary>
    public static string? BourseTimelineLocation(string? city, string? district)
    {
        var location = string.Join(
            " · ",
            new[] { city, district }
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s!.Trim()));
        return string.IsNullOrEmpty(location) ? null : location;
    }

    /// <summary>A fresh entity carrying only the enfath (intake) half of the property.</summary>
    public static WorkOrderProperty NewPropertyFromEnfath(
        WorkOrderPropertyDto dto,
        Guid workOrderId,
        bool forInsert)
    {
        var entity = new WorkOrderProperty
        {
            Id = forInsert ? Guid.NewGuid() : (dto.Id ?? Guid.NewGuid()),
            WorkOrderId = workOrderId,
            BourseDataCompleted = false,
        };
        ApplyPropertyEnfath(entity, dto);
        ReplacePropertyContacts(entity, dto.Contacts, clearExisting: false);
        return entity;
    }

    /// <summary>Restrictions only matter when the answer is "yes", and only for known kinds.</summary>
    public static string? NormalizeRestrictionType(string? present, string? type)
    {
        if (!string.Equals(present?.Trim(), "yes", StringComparison.OrdinalIgnoreCase))
            return null;
        if (string.IsNullOrWhiteSpace(type)) return null;
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var parts = new List<string>();
        foreach (var raw in type.Split(
                     [',', '،'],
                     StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var v = raw.ToLowerInvariant();
            if (v is not ("mortgaged" or "seized" or "suspended" or "other")) continue;
            if (!seen.Add(v)) continue;
            parts.Add(v);
        }

        return parts.Count == 0 ? null : string.Join(",", parts);
    }

    /// <summary>The free-text reason is kept only for the "other" restriction kind.</summary>
    public static string? NormalizeRestrictionOtherReason(
        string? present,
        string? type,
        string? reason)
    {
        if (!string.Equals(present?.Trim(), "yes", StringComparison.OrdinalIgnoreCase))
            return null;
        var types = (type ?? "")
            .Split([',', '،'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(t => t.ToLowerInvariant());
        if (!types.Contains("other")) return null;
        return IWorkOrderLoader.NormalizeOptionalText(reason);
    }

    /// <summary>Known codes are stored lowercase; anything else is kept as typed.</summary>
    public static string? NormalizeBoundaryType(string? value) =>
        NormalizeKnownCode(value, PropertyBoundaryTypes.IsKnown);

    public static string? NormalizeFinishingType(string? value) =>
        NormalizeKnownCode(value, PropertyFinishingTypes.IsKnown);

    public static string? NormalizeFinishingStructure(string? value) =>
        NormalizeKnownCode(value, PropertyFinishingStructures.IsKnown);

    private static string? NormalizeKnownCode(string? value, Func<string, bool> isKnown)
    {
        var t = IWorkOrderLoader.NormalizeOptionalText(value);
        if (t is null) return null;
        return isKnown(t) ? t.Trim().ToLowerInvariant() : t;
    }

    /// <summary>Contacts without a phone or a role are noise and are dropped.</summary>
    public static List<PropertyContact> BuildContacts(
        Guid propertyId,
        IEnumerable<PropertyContactDto> contacts)
    {
        var order = 0;
        return contacts
            .Where(c => !string.IsNullOrWhiteSpace(c.Phone) || !string.IsNullOrWhiteSpace(c.Role))
            .Select(c => new PropertyContact
            {
                Id = Guid.NewGuid(),
                PropertyId = propertyId,
                Name = (c.Name ?? "").Trim(),
                Role = (c.Role ?? "").Trim(),
                Phone = (c.Phone ?? "").Trim(),
                NationalId = NormalizeNationalId(c.NationalId),
                SortOrder = order++,
            })
            .ToList();
    }

    internal static string NormalizeNationalId(string? value)
    {
        var digits = Texts.DigitsOnly(value ?? "");
        return digits.Length <= 16 ? digits : digits[..16];
    }

    public static void ReplacePropertyContacts(
        WorkOrderProperty entity,
        IEnumerable<PropertyContactDto> contacts,
        bool clearExisting)
    {
        if (clearExisting) entity.Contacts.Clear();
        foreach (var contact in BuildContacts(entity.Id, contacts))
            entity.Contacts.Add(contact);
    }

    /// <summary>The enfath (intake) half of a property: identifiers, documents, place, plan.</summary>
    public static void ApplyPropertyEnfath(WorkOrderProperty entity, WorkOrderPropertyDto dto)
    {
        PropertyIdentifierTypeLabels.TryParseApiValue(dto.IdentifierType, out var idType);
        entity.IdentifierType = idType;

 // suggestion from the identifier; the valuer's explicit choice wins.
        entity.DeedKind =
            !string.IsNullOrWhiteSpace(dto.DeedKind)
            && DeedKindLabels.TryParseApiValue(dto.DeedKind, out var deedKind)
                ? deedKind
                : DeedKindLabels.SuggestFromIdentifier(idType);

        if (idType == PropertyIdentifierType.BourseInquiry &&
            string.IsNullOrWhiteSpace(dto.DeedNumber))
        {
            entity.DeedNumber = $"INQ-{entity.Id.ToString("N")[..8].ToUpperInvariant()}";
        }
        else
        {
            entity.DeedNumber = dto.DeedNumber.Trim();
        }

        entity.RequestNumber = dto.RequestNumber?.Trim();
        entity.HasRequestNumber = dto.HasRequestNumber;
        entity.AssignmentMandateNumber = dto.AssignmentMandateNumber?.Trim();
        entity.AssignmentMandateDate = dto.AssignmentMandateDate?.Trim();
        entity.DeedDate = dto.DeedDate?.Trim();
        entity.RealEstateRegNumber = dto.RealEstateRegNumber?.Trim();
        entity.RealEstateRegDate = dto.RealEstateRegDate?.Trim();
        entity.OwnerName = dto.OwnerName?.Trim();
        entity.AssignmentDocFileName = PropertyFileNameList.Serialize(dto.AssignmentDocFileNames);
        entity.DelegationLetterFileName = PropertyFileNameList.Serialize(dto.DelegationLetterFileNames);
        entity.OtherDocumentFileNames = PropertyFileNameList.Serialize(dto.OtherDocumentFileNames);
        entity.RealEstateRegFileName = dto.RealEstateRegFileName?.Trim();
        entity.DeedOwnershipFileName = dto.DeedOwnershipFileName?.Trim();
        entity.BourseDeedImageFileName = dto.BourseDeedImageFileName?.Trim();
        entity.CourtId = dto.CourtId;
        entity.CircuitId = dto.CircuitId;
        entity.RegionId = dto.RegionId;
        entity.CityId = dto.CityId;
        entity.Court = dto.Court?.Trim();
        entity.Circuit = dto.Circuit?.Trim();
        entity.Region = dto.Region?.Trim();
        entity.District = dto.District?.Trim() ?? "";
        entity.Classification = dto.Classification?.Trim() ?? "";
        entity.PropertyType = dto.PropertyType?.Trim() ?? "";
        entity.DeedStatus = dto.DeedStatus?.Trim();
        entity.Area = dto.Area?.Trim();
        entity.PlanNumber = IWorkOrderLoader.NormalizeOptionalText(dto.PlanNumber);
        entity.PlanName = IWorkOrderLoader.NormalizeOptionalText(dto.PlanName);
        entity.PlotNumber = IWorkOrderLoader.NormalizeOptionalText(dto.PlotNumber);
        entity.BlockNumber = IWorkOrderLoader.NormalizeOptionalText(dto.BlockNumber);
        entity.LocationMapUrl = IWorkOrderLoader.NormalizeOptionalText(dto.LocationMapUrl);
        entity.PartitionMinutesNumber = IWorkOrderLoader.NormalizeOptionalText(dto.PartitionMinutesNumber);
        entity.PartitionMinutesDate = IWorkOrderLoader.NormalizeOptionalText(dto.PartitionMinutesDate);
        entity.FinishingType = NormalizeFinishingType(dto.FinishingType);
        entity.FinishingStructure = NormalizeFinishingStructure(dto.FinishingStructure);
        if (dto.SpecialistReportExtrasJson is not null)
            SpecialistReportExtrasRules.ApplyFromWireJson(entity, dto.SpecialistReportExtrasJson);
    }

    /// <summary>The bourse half as it arrives inside the property DTO.</summary>
    public static void ApplyPropertyBourse(WorkOrderProperty entity, WorkOrderPropertyDto dto)
    {
        entity.City = dto.City.Trim();
        entity.Region = dto.Region?.Trim();
        entity.RegionId = dto.RegionId;
        entity.CityId = dto.CityId;
        entity.District = dto.District.Trim();
        entity.Classification = dto.Classification.Trim();
        entity.PropertyType = dto.PropertyType.Trim();
        entity.Area = dto.Area?.Trim();
        entity.DeedStatus = dto.DeedStatus?.Trim();
        entity.BourseDeedImageFileName = dto.BourseDeedImageFileName?.Trim();
        entity.RestrictionsPresent = dto.RestrictionsPresent?.Trim();
        entity.RestrictionType = NormalizeRestrictionType(dto.RestrictionsPresent, dto.RestrictionType);
        entity.RestrictionOtherReason = NormalizeRestrictionOtherReason(
            dto.RestrictionsPresent,
            dto.RestrictionType,
            dto.RestrictionOtherReason);
        entity.BoundariesAvailability = dto.BoundariesAvailability?.Trim();
        entity.BoundariesExternalDocName = dto.BoundariesExternalDocName?.Trim();
        ApplyBoundaries(
            entity,
            dto.NorthBoundary, dto.NorthBoundaryLengthM, dto.NorthBoundaryType, dto.NorthFacadeFinishing,
            dto.SouthBoundary, dto.SouthBoundaryLengthM, dto.SouthBoundaryType, dto.SouthFacadeFinishing,
            dto.EastBoundary, dto.EastBoundaryLengthM, dto.EastBoundaryType, dto.EastFacadeFinishing,
            dto.WestBoundary, dto.WestBoundaryLengthM, dto.WestBoundaryType, dto.WestFacadeFinishing);
    }

    /// <summary>
    /// Soft field autosave for البورصة transcription — same columns as
    /// <see cref="ApplyPropertyBourse"/> plus owners/ownership, without completing the phase.
    /// </summary>
    public static void ApplyPropertyBourseDraft(WorkOrderProperty entity, WorkOrderPropertyDto dto)
    {
        ApplyPropertyBourse(entity, dto);
        ApplyOwners(entity, dto.Owners);
    }

    /// <summary>
    /// The transcribed owners, blank names dropped; the first one becomes the owner name. Null
    /// leaves the stored owners as they are.
    /// </summary>
    private static void ApplyOwners(WorkOrderProperty entity, IEnumerable<DeedOwnerDto>? owners)
    {
        if (owners is null) return;

        var named = owners
            .Select(o => new DeedOwner(o.Name?.Trim() ?? ""))
            .Where(o => !string.IsNullOrWhiteSpace(o.Name))
            .ToList();
        entity.DeedOwnersJson = OwnershipTypeRules.SerializeOwners(named);
        if (named.Count > 0)
            entity.OwnerName = named[0].Name;
    }

    /// <summary>
    /// The bourse transcription as its own request: same columns, plus the owners/ownership-type
    /// decisions. Returns the error dictionary to hand back (null when the request applied).
    ///
    /// Saving always completes the bourse, whatever the boundaries source is. «غير متوفرة» only means the
    /// bourse had no boundaries to transcribe: it neither holds the property open nor raises a failure (it
    /// used to, although the screen says «ويمكن الحفظ مباشرة»).
    /// </summary>
    public static Dictionary<string, string>? ApplyBourseRequest(
        WorkOrderProperty entity,
        UpdatePropertyBourseRequest request,
        DateTime nowUtc,
        string? completedByName = null)
    {
        entity.City = request.City.Trim();
        entity.Region = request.Region?.Trim();
        entity.RegionId = request.RegionId;
        entity.CityId = request.CityId;
        entity.District = request.District.Trim();
        entity.Classification = request.Classification.Trim();
        entity.PropertyType = request.PropertyType.Trim();
        entity.Area = request.Area?.Trim();
        entity.DeedStatus = request.DeedStatus?.Trim();
        entity.BourseDeedImageFileName = request.BourseDeedImageFileName?.Trim();
        entity.RestrictionsPresent = request.RestrictionsPresent?.Trim();
        entity.RestrictionType = NormalizeRestrictionType(request.RestrictionsPresent,request.RestrictionType);
        entity.RestrictionOtherReason = NormalizeRestrictionOtherReason(request.RestrictionsPresent, request.RestrictionType, request.RestrictionOtherReason);

 // owners from the transcription; the ownership type is derived from their count (never stored).
        ApplyOwners(entity, request.Owners);

        entity.BoundariesAvailability = request.BoundariesAvailability?.Trim();
        entity.BoundariesExternalDocName = request.BoundariesExternalDocName?.Trim();
        ApplyBoundaries(
            entity,
            request.NorthBoundary, request.NorthBoundaryLengthM, request.NorthBoundaryType, request.NorthFacadeFinishing,
            request.SouthBoundary, request.SouthBoundaryLengthM, request.SouthBoundaryType, request.SouthFacadeFinishing,
            request.EastBoundary, request.EastBoundaryLengthM, request.EastBoundaryType, request.EastFacadeFinishing,
            request.WestBoundary, request.WestBoundaryLengthM, request.WestBoundaryType, request.WestFacadeFinishing);

        entity.BourseDataCompleted = true;
        entity.BourseCompletedAtUtc = nowUtc;
        entity.BourseCompletedByName = NormalizeActorName(completedByName);

        return null;
    }

    /// <summary>«المدينة · الحي — أدخله الاسم»: the bourse milestone's detail line (null when nothing to say).</summary>
    public static string? BourseTimelineDetail(string? city, string? district, string? completedByName)
    {
        var location = BourseTimelineLocation(city, district);
        var by = NormalizeActorName(completedByName);
        if (by is null) return string.IsNullOrEmpty(location) ? null : location;
        var who = EnteredByText(by);
        return string.IsNullOrEmpty(location) ? who : $"{location} — {who}";
    }

    /// <summary>
    /// «أخصائي الإسناد: …  — أدخله الاسم»: the Enfaz-receipt milestone's detail — the order's assignment
    /// specialist and who registered it, either part dropped when unknown (null when both are).
    /// </summary>
    public static string? EnfathReceivedTimelineDetail(string? assignmentSpecialist, string? receivedByName)
    {
        var specialist = assignmentSpecialist?.Trim();
        var specialistPart = string.IsNullOrEmpty(specialist) ? null : $"أخصائي الإسناد: {specialist}";
        var who = PrimaryDataTimelineDetail(receivedByName);
        if (specialistPart is null) return who;
        return who is null ? specialistPart : $"{specialistPart} — {who}";
    }

    /// <summary>«أدخله الاسم»: the primary-data milestone's detail line, like the bourse one (null without a name).</summary>
    public static string? PrimaryDataTimelineDetail(string? completedByName)
    {
        var by = NormalizeActorName(completedByName);
        return by is null ? null : EnteredByText(by);
    }

    /// <summary>«أدخله الاسم» — the one wording of who entered a milestone, shared by every timeline detail line.</summary>
    /// <remarks>
    /// How it works: prefixes an already-normalised actor name with «أدخله ». Callers get the name from
    /// NormalizeActorName, which returns null for a blank name — so this is never called with an empty
    /// name and a milestone without an actor simply has no «أدخله» part. The bourse, primary-data and
    /// Enfath-receipt detail lines each wrote this literal by hand; they now share it, so the wording
    /// cannot drift between the three timeline milestones.
    /// </remarks>
    private static string EnteredByText(string name) => $"أدخله {name}";

    /// <summary>The display name stored beside the completion stamp: trimmed, bounded, null when empty.</summary>
    public static string? NormalizeActorName(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length <= 128 ? trimmed : trimmed[..128];
    }

    private static void ApplyBoundaries(
        WorkOrderProperty entity,
        string? north, string? northLength, string? northType, string? northFacade,
        string? south, string? southLength, string? southType, string? southFacade,
        string? east, string? eastLength, string? eastType, string? eastFacade,
        string? west, string? westLength, string? westType, string? westFacade)
    {
        entity.NorthBoundary = IWorkOrderLoader.NormalizeOptionalText(north);
        entity.NorthBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(northLength);
        entity.NorthBoundaryType = NormalizeBoundaryType(northType);
        entity.NorthFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(northFacade);
        entity.SouthBoundary = IWorkOrderLoader.NormalizeOptionalText(south);
        entity.SouthBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(southLength);
        entity.SouthBoundaryType = NormalizeBoundaryType(southType);
        entity.SouthFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(southFacade);
        entity.EastBoundary = IWorkOrderLoader.NormalizeOptionalText(east);
        entity.EastBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(eastLength);
        entity.EastBoundaryType = NormalizeBoundaryType(eastType);
        entity.EastFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(eastFacade);
        entity.WestBoundary = IWorkOrderLoader.NormalizeOptionalText(west);
        entity.WestBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(westLength);
        entity.WestBoundaryType = NormalizeBoundaryType(westType);
        entity.WestFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(westFacade);
    }
}
