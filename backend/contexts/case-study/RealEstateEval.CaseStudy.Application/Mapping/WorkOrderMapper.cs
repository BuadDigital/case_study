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
            ValuationPurposeKey = entity.ValuationPurposeKey,
            BasisOfValueKey = entity.BasisOfValueKey,
            ValuePremiseKey = entity.ValuePremiseKey,
            Properties = entity.Properties
                .OrderBy(p => p.DeedNumber)
                .Select(ToPropertyDto)
                .ToList(),
        };
    }

    public static WorkOrderPropertyDto ToPropertyDto(WorkOrderProperty p)
    {
        var owners = OwnershipTypeRules.ParseOwners(p.DeedOwnersJson);
        var ownershipType = OwnershipTypeRules.FromOwners(owners);

        return new WorkOrderPropertyDto
        {
            Id = p.Id,
            IdentifierType = PropertyIdentifierTypeLabels.ToApiValue(p.IdentifierType),
            DeedKind = DeedKindLabels.ToApiValue(p.DeedKind),
            DeedKindLabelAr = DeedKindLabels.LabelAr(p.DeedKind),
            SuggestedDeedKind = DeedKindLabels.ToApiValue(
                DeedKindLabels.SuggestFromIdentifier(p.IdentifierType)),
            DeedNumber = p.DeedNumber,
            // The numbers now live on the transaction above the deed (draft TMP,
            // official PR); the deed count lets the screens show «N صكوك» for a merged transaction.
            TransactionId = p.TransactionId == Guid.Empty ? null : p.TransactionId,
            TransactionDraftNumber = p.Transaction?.DraftNumber,
            ReferenceNumber = p.Transaction?.ReferenceNumber,
            TransactionLinkKind = p.Transaction?.LinkKind,
            TransactionDeedCount = Math.Max(1, p.Transaction?.Properties.Count(d => !d.IsRemoved) ?? 1),
            RequestNumber = p.RequestNumber,
            HasRequestNumber = p.HasRequestNumber,
            AssignmentMandateNumber = p.AssignmentMandateNumber,
            AssignmentMandateDate = p.AssignmentMandateDate,
            DeedDate = p.DeedDate,
            RealEstateRegNumber = p.RealEstateRegNumber,
            RealEstateRegDate = p.RealEstateRegDate,
            OwnerName = p.OwnerName,
            Owners = owners
                .Select(o => new DeedOwnerDto { Name = o.Name })
                .ToList(),
            OwnershipType = ownershipType,
            OwnershipTypeLabelAr = OwnershipTypes.LabelAr(ownershipType),
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
            InspectedPropertyType = p.InspectedPropertyType,
            EffectivePropertyType = InspectedPropertyTypeRules.Effective(
                p.PropertyType,
                p.InspectedPropertyType),
            AssignmentDocFileNames = ParseFileNameList(p.AssignmentDocFileName),
            DelegationLetterFileNames = ParseFileNameList(p.DelegationLetterFileName),
            OtherDocumentFileNames = ParseFileNameList(p.OtherDocumentFileNames),
            RealEstateRegFileName = p.RealEstateRegFileName,
            DeedOwnershipFileName = p.DeedOwnershipFileName,
            BourseDeedImageFileName = p.BourseDeedImageFileName,
            BourseDataCompleted = p.BourseDataCompleted,
            BourseCompletedByName = p.BourseCompletedByName,
            BourseCompletedAtUtc = p.BourseCompletedAtUtc?.ToString("O"),
            PlanNumber = p.PlanNumber,
            PlanName = p.PlanName,
            PlotNumber = p.PlotNumber,
            BlockNumber = p.BlockNumber,
            LocationMapUrl = p.LocationMapUrl,
            PartitionMinutesNumber = p.PartitionMinutesNumber,
            PartitionMinutesDate = p.PartitionMinutesDate,
            FinishingType = p.FinishingType,
            FinishingStructure = p.FinishingStructure,
            SpecialistReportExtrasJson = SpecialistReportExtrasRules.ToWireJson(p),
            SpecialistReportExtrasProvenanceJson = p.SpecialistReportExtrasProvenanceJson,
            IsRemoved = p.IsRemoved,
            RemovalReason = p.RemovalReason,
            RemovedAtUtc = p.RemovedAtUtc?.ToString("o"),
            UpdatedAtUtc = p.UpdatedAtUtc == default ? null : p.UpdatedAtUtc.ToString("o"),
            Contacts = p.Contacts
                .OrderBy(c => c.SortOrder)
                .Select(c => new PropertyContactDto
                {
                    Name = c.Name,
                    Role = c.Role,
                    Phone = c.Phone,
                    NationalId = c.NationalId,
                })
                .ToList(),
        };
    }

 /// <summary>
 /// Accepts legacy plain filename or JSON array string in the same column.
 /// </summary>
    public static List<string> ParseFileNameList(string? stored) =>
        PropertyFileNameList.Parse(stored);

    public static bool HasStoredFileNames(string? stored) =>
        PropertyFileNameList.HasAny(stored);

    /// <param name="readyByProperty">Live property → its tasks are all complete (or it is closed).</param>
    /// <param name="closedByProperty">Live property → handed over to Enfaz, or every task cancelled.</param>
    public static WorkOrderListItemDto ToListItem(
        WorkOrder entity,
        IReadOnlyDictionary<Guid, bool>? readyByProperty = null,
        IReadOnlyDictionary<Guid, bool>? closedByProperty = null,
        bool hasEnfazInvoice = false,
        int progressPct = 0)
    {
        var liveProperties = entity.Properties.Where(p => !p.IsRemoved).ToList();
        var readyCount = liveProperties.Count(p => Flag(readyByProperty, p.Id));
        var closedCount = liveProperties.Count(p => Flag(closedByProperty, p.Id));

        return new WorkOrderListItemDto
        {
            PoNumber = entity.PoNumber,
            AssignmentType = AssignmentTypeLabels.ToLabel(entity.AssignmentType),
            PropertyCount = liveProperties.Count,
            ExpectedPropertyCount = entity.ExpectedPropertyCount,
            CompletedCount = closedCount,
            ProgressPct = Math.Clamp(progressPct, 0, 100),
            Status = WorkOrderListStatus.Resolve(
                entity.LifecycleStatus,
                entity.ExpectedPropertyCount,
                liveProperties.Count,
                readyCount,
                closedCount,
                hasEnfazInvoice),
            StudyStatus = WorkOrderListStatus.ResolveStudy(
                entity.LifecycleStatus,
                entity.ExpectedPropertyCount,
                liveProperties.Count,
                readyCount,
                closedCount),
            PromulgationDate = entity.PromulgationDate.ToString("yyyy-MM-dd"),
            ReceivedFromEnfathAt = entity.ReceivedFromEnfathAt.ToString("yyyy-MM-dd"),
            DueDateAt = entity.DueDateAt.ToString("yyyy-MM-dd"),
            AssignmentSpecialist = entity.AssignmentSpecialist ?? "",
            WorkOrderDescription = entity.WorkOrderDescription,
            PropertiesRegion = entity.PropertiesRegion,
            CreatedAtUtc = entity.CreatedAtUtc.ToString("O"),
        };
    }

    private static bool Flag(IReadOnlyDictionary<Guid, bool>? flags, Guid propertyId) =>
        flags is not null && flags.TryGetValue(propertyId, out var value) && value;

    /// <summary>
    /// <paramref name="transactionNumber"/> lets a caller that already resolved the transaction pass its
    /// display number (PR once confirmed, else TMP); otherwise it is read from the loaded transaction.
    /// </summary>
    public static PendingBoursePropertyDto ToPendingBourse(WorkOrderProperty p, string? transactionNumber = null)
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
            TransactionNumber = transactionNumber ?? p.Transaction?.DisplayNumber,
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
                    NationalId = c.NationalId,
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
