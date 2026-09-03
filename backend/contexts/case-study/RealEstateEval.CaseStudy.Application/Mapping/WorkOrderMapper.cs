using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Mapping;

public static class WorkOrderMapper
{
    public static WorkOrderDto ToDto(WorkOrder entity)
    {
        return new WorkOrderDto
        {
            Id = entity.Id,
            PoNumber = entity.PoNumber,
            AssignmentType = AssignmentTypeLabels.ToLabel(entity.AssignmentType),
            PromulgationDate = entity.PromulgationDate.ToString("yyyy-MM-dd"),
            ReceivedFromEnfathAt = entity.ReceivedFromEnfathAt.ToString("yyyy-MM-dd"),
            ReceivedFromEnfathTime = entity.ReceivedFromEnfathTime,
            AssignmentSpecialist = entity.AssignmentSpecialist ?? "",
            AssignmentSpecialistEmail = entity.AssignmentSpecialistEmail ?? "",
            ExpectedPropertyCount = entity.ExpectedPropertyCount,
            DueDateAt = entity.DueDateAt.ToString("yyyy-MM-dd"),
            CreatedAtUtc = entity.CreatedAtUtc.ToString("o"),
            PropertiesRegion = entity.PropertiesRegion,
            WorkOrderDescription = entity.WorkOrderDescription,
            ClientId = entity.ClientId,
            ClientNameAr = entity.Client?.NameAr,
            ReportUserClientIds = [.. WorkOrderReportUsers.Parse(entity.ReportUserClientIdsJson)],
            Properties = entity.Properties
                .OrderBy(p => p.DeedNumber)
                .Select(ToPropertyDto)
                .ToList(),
        };
    }

    public static WorkOrderPropertyDto ToPropertyDto(WorkOrderProperty p)
    {
        var owners = OwnershipTypeRules.ParseOwners(p.DeedOwnersJson);
        var suggestedOwnership = OwnershipTypeRules.Suggest(owners, p.RestrictionType);
        var effectiveOwnership = OwnershipTypeRules.Effective(
            p.OwnershipTypeIsManual, p.OwnershipType, owners, p.RestrictionType);

        return new WorkOrderPropertyDto
        {
            Id = p.Id,
            IdentifierType = PropertyIdentifierTypeLabels.ToApiValue(p.IdentifierType),
            DeedKind = DeedKindLabels.ToApiValue(p.DeedKind),
            DeedKindLabelAr = DeedKindLabels.LabelAr(p.DeedKind),
            SuggestedDeedKind = DeedKindLabels.ToApiValue(
                DeedKindLabels.SuggestFromIdentifier(p.IdentifierType)),
            DeedNumber = p.DeedNumber,
            ReferenceNumber = p.ReferenceNumber,
            RequestNumber = p.RequestNumber,
            HasRequestNumber = p.HasRequestNumber,
            AssignmentMandateNumber = p.AssignmentMandateNumber,
            AssignmentMandateDate = p.AssignmentMandateDate,
            DeedDate = p.DeedDate,
            RealEstateRegNumber = p.RealEstateRegNumber,
            RealEstateRegDate = p.RealEstateRegDate,
            OwnerName = p.OwnerName,
            Owners = owners
                .Select(o => new DeedOwnerDto { Name = o.Name, SharePct = o.SharePct })
                .ToList(),
            OwnershipType = effectiveOwnership,
            OwnershipTypeLabelAr = OwnershipTypes.LabelAr(effectiveOwnership),
            SuggestedOwnershipType = suggestedOwnership,
            OwnershipTypeIsManual = p.OwnershipTypeIsManual,
            RestrictionsPresent = p.RestrictionsPresent,
            RestrictionType = p.RestrictionType,
            RestrictionOtherReason = p.RestrictionOtherReason,
            BoundariesAvailability = p.BoundariesAvailability,
            BoundariesExternalDocName = p.BoundariesExternalDocName,
            NorthBoundary = p.NorthBoundary,
            NorthBoundaryLengthM = p.NorthBoundaryLengthM,
            NorthBoundaryType = p.NorthBoundaryType,
            NorthFacadeFinishing = p.NorthFacadeFinishing,
            SouthBoundary = p.SouthBoundary,
            SouthBoundaryLengthM = p.SouthBoundaryLengthM,
            SouthBoundaryType = p.SouthBoundaryType,
            SouthFacadeFinishing = p.SouthFacadeFinishing,
            EastBoundary = p.EastBoundary,
            EastBoundaryLengthM = p.EastBoundaryLengthM,
            EastBoundaryType = p.EastBoundaryType,
            EastFacadeFinishing = p.EastFacadeFinishing,
            WestBoundary = p.WestBoundary,
            WestBoundaryLengthM = p.WestBoundaryLengthM,
            WestBoundaryType = p.WestBoundaryType,
            WestFacadeFinishing = p.WestFacadeFinishing,
            City = p.City,
            Region = p.Region,
            District = p.District,
            DeedStatus = p.DeedStatus,
            Area = p.Area,
            Court = p.Court,
            Circuit = p.Circuit,
            CourtId = p.CourtId,
            CircuitId = p.CircuitId,
            RegionId = p.RegionId,
            CityId = p.CityId,
            Classification = p.Classification,
            PropertyType = p.PropertyType,
            AssignmentDocFileNames = ParseFileNameList(p.AssignmentDocFileName),
            DelegationLetterFileNames = ParseFileNameList(p.DelegationLetterFileName),
            OtherDocumentFileNames = ParseFileNameList(p.OtherDocumentFileNames),
            RealEstateRegFileName = p.RealEstateRegFileName,
            DeedOwnershipFileName = p.DeedOwnershipFileName,
            BourseDeedImageFileName = p.BourseDeedImageFileName,
            BourseDataCompleted = p.BourseDataCompleted,
            PlanNumber = p.PlanNumber,
            PlanName = p.PlanName,
            PlotNumber = p.PlotNumber,
            BlockNumber = p.BlockNumber,
            LocationMapUrl = p.LocationMapUrl,
            PartitionMinutesNumber = p.PartitionMinutesNumber,
            PartitionMinutesDate = p.PartitionMinutesDate,
            FinishingType = p.FinishingType,
            FinishingStructure = p.FinishingStructure,
            SpecialistReportExtrasJson = p.SpecialistReportExtrasJson,
            IsRemoved = p.IsRemoved,
            RemovalReason = p.RemovalReason,
            RemovedAtUtc = p.RemovedAtUtc?.ToString("o"),
            Contacts = p.Contacts
                .OrderBy(c => c.SortOrder)
                .Select(c => new PropertyContactDto
                {
                    Name = c.Name,
                    Role = c.Role,
                    Phone = c.Phone,
                })
                .ToList(),
        };
    }

 /// <summary>
 /// Accepts legacy plain filename or JSON array string in the same column.
 /// </summary>
    public static List<string> ParseFileNameList(string? stored) =>
        PropertyFileNameList.Parse(stored);

    public static string? SerializeFileNameList(IEnumerable<string>? names) =>
        PropertyFileNameList.Serialize(names);

    public static bool HasStoredFileNames(string? stored) =>
        PropertyFileNameList.HasAny(stored);

    public static WorkOrderListItemDto ToListItem(
        WorkOrder entity,
        IReadOnlyDictionary<Guid, bool>? studiedByProperty = null,
        bool hasEnfazInvoice = false)
    {
        var liveProperties = entity.Properties.Where(p => !p.IsRemoved).ToList();
        var studiedCount = liveProperties.Count(p =>
            studiedByProperty is not null
            && studiedByProperty.TryGetValue(p.Id, out var studied)
            && studied);

        return new WorkOrderListItemDto
        {
            PoNumber = entity.PoNumber,
            AssignmentType = AssignmentTypeLabels.ToLabel(entity.AssignmentType),
            PropertyCount = liveProperties.Count,
            ExpectedPropertyCount = entity.ExpectedPropertyCount,
            CompletedCount = studiedCount,
            Status = WorkOrderListStatus.Resolve(
                entity.LifecycleStatus,
                entity.ExpectedPropertyCount,
                liveProperties.Count,
                studiedCount,
                hasEnfazInvoice),
            PromulgationDate = entity.PromulgationDate.ToString("yyyy-MM-dd"),
            ReceivedFromEnfathAt = entity.ReceivedFromEnfathAt.ToString("yyyy-MM-dd"),
            DueDateAt = entity.DueDateAt.ToString("yyyy-MM-dd"),
            AssignmentSpecialist = entity.AssignmentSpecialist ?? "",
            WorkOrderDescription = entity.WorkOrderDescription,
            PropertiesRegion = entity.PropertiesRegion,
            CreatedAtUtc = entity.CreatedAtUtc.ToString("O"),
        };
    }

    public static PendingBoursePropertyDto ToPendingBourse(WorkOrderProperty p)
    {
        return new PendingBoursePropertyDto
        {
            PoNumber = p.WorkOrder!.PoNumber,
            PropertyId = p.Id,
            IdentifierType = PropertyIdentifierTypeLabels.ToApiValue(p.IdentifierType),
            DeedNumber = p.DeedNumber,
            DeedDate = p.DeedDate,
            OwnerName = p.OwnerName,
            RequestNumber = p.RequestNumber,
            AssignmentType = AssignmentTypeLabels.ToLabel(p.WorkOrder.AssignmentType),
            ReceivedFromEnfathAt = p.WorkOrder.ReceivedFromEnfathAt.ToString("yyyy-MM-dd"),
            DueDateAt = p.WorkOrder.DueDateAt.ToString("yyyy-MM-dd"),
            CreatedAtUtc = p.WorkOrder.CreatedAtUtc.ToString("O"),
        };
    }

    public static PriorDeedRegistrationDto ToPriorDeedDto(WorkOrderProperty p, string poNumber)
    {
        return new PriorDeedRegistrationDto
        {
            PoNumber = poNumber,
            PropertyId = p.Id,
            DeedNumber = p.DeedNumber,
            IdentifierType = PropertyIdentifierTypeLabels.ToApiValue(p.IdentifierType),
            DeedDate = p.DeedDate,
            OwnerName = p.OwnerName,
            RequestNumber = p.RequestNumber,
            AssignmentMandateNumber = p.AssignmentMandateNumber,
            AssignmentMandateDate = p.AssignmentMandateDate,
            Court = p.Court,
            Circuit = p.Circuit,
            CourtId = p.CourtId,
            CircuitId = p.CircuitId,
            Contacts = p.Contacts
                .OrderBy(c => c.SortOrder)
                .Select(c => new PropertyContactDto
                {
                    Name = c.Name,
                    Role = c.Role,
                    Phone = c.Phone,
                })
                .ToList(),
            Region = p.Region,
            RegionId = p.RegionId,
            City = p.City,
            CityId = p.CityId,
            District = p.District,
            Classification = p.Classification,
            PropertyType = p.PropertyType,
            Area = p.Area,
            DeedStatus = p.DeedStatus,
            RestrictionsPresent = p.RestrictionsPresent,
            RestrictionType = p.RestrictionType,
            RestrictionOtherReason = p.RestrictionOtherReason,
            BoundariesAvailability = p.BoundariesAvailability,
            BoundariesExternalDocName = p.BoundariesExternalDocName,
            NorthBoundary = p.NorthBoundary,
            NorthBoundaryLengthM = p.NorthBoundaryLengthM,
            NorthBoundaryType = p.NorthBoundaryType,
            NorthFacadeFinishing = p.NorthFacadeFinishing,
            SouthBoundary = p.SouthBoundary,
            SouthBoundaryLengthM = p.SouthBoundaryLengthM,
            SouthBoundaryType = p.SouthBoundaryType,
            SouthFacadeFinishing = p.SouthFacadeFinishing,
            EastBoundary = p.EastBoundary,
            EastBoundaryLengthM = p.EastBoundaryLengthM,
            EastBoundaryType = p.EastBoundaryType,
            EastFacadeFinishing = p.EastFacadeFinishing,
            WestBoundary = p.WestBoundary,
            WestBoundaryLengthM = p.WestBoundaryLengthM,
            WestBoundaryType = p.WestBoundaryType,
            WestFacadeFinishing = p.WestFacadeFinishing,
            PlanNumber = p.PlanNumber,
            PlanName = p.PlanName,
            PlotNumber = p.PlotNumber,
            BlockNumber = p.BlockNumber,
            LocationMapUrl = p.LocationMapUrl,
            PartitionMinutesNumber = p.PartitionMinutesNumber,
            PartitionMinutesDate = p.PartitionMinutesDate,
            FinishingType = p.FinishingType,
            FinishingStructure = p.FinishingStructure,
            BourseDataCompleted = p.BourseDataCompleted,
            WorkOrderCreatedAtUtc = p.WorkOrder?.CreatedAtUtc.ToString("O"),
            AssignmentDocFileNames = ParseFileNameList(p.AssignmentDocFileName),
            DelegationLetterFileNames = ParseFileNameList(p.DelegationLetterFileName),
            OtherDocumentFileNames = ParseFileNameList(p.OtherDocumentFileNames),
            RealEstateRegFileName = p.RealEstateRegFileName,
            DeedOwnershipFileName = p.DeedOwnershipFileName,
            BourseDeedImageFileName = p.BourseDeedImageFileName,
            RealEstateRegNumber = p.RealEstateRegNumber,
            RealEstateRegDate = p.RealEstateRegDate,
            HasRequestNumber = p.HasRequestNumber,
        };
    }
}
