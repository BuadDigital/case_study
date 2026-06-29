using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using System.Text.Json;

namespace RealEstateEval.Infrastructure.Services;

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
            Properties = entity.Properties
                .OrderBy(p => p.DeedNumber)
                .Select(ToPropertyDto)
                .ToList(),
        };
    }

    public static WorkOrderPropertyDto ToPropertyDto(WorkOrderProperty p)
    {
        List<string> otherDocs = [];
        if (!string.IsNullOrWhiteSpace(p.OtherDocumentFileNames))
        {
            try
            {
                otherDocs = JsonSerializer.Deserialize<List<string>>(p.OtherDocumentFileNames) ?? [];
            }
            catch
            {
                otherDocs = [];
            }
        }

        return new WorkOrderPropertyDto
        {
            Id = p.Id,
            IdentifierType = PropertyIdentifierTypeLabels.ToApiValue(p.IdentifierType),
            DeedNumber = p.DeedNumber,
            TaskNumber = p.TaskNumber,
            DeedDate = p.DeedDate,
            OwnerName = p.OwnerName,
            RestrictionsPresent = p.RestrictionsPresent,
            BoundariesAvailability = p.BoundariesAvailability,
            BoundariesExternalDocName = p.BoundariesExternalDocName,
            NorthBoundary = p.NorthBoundary,
            NorthBoundaryLengthM = p.NorthBoundaryLengthM,
            SouthBoundary = p.SouthBoundary,
            SouthBoundaryLengthM = p.SouthBoundaryLengthM,
            EastBoundary = p.EastBoundary,
            EastBoundaryLengthM = p.EastBoundaryLengthM,
            WestBoundary = p.WestBoundary,
            WestBoundaryLengthM = p.WestBoundaryLengthM,
            City = p.City,
            District = p.District,
            DeedStatus = p.DeedStatus,
            Area = p.Area,
            Court = p.Court,
            Circuit = p.Circuit,
            Classification = p.Classification,
            PropertyType = p.PropertyType,
            AssignmentDocFileName = p.AssignmentDocFileName,
            DelegationLetterFileName = p.DelegationLetterFileName,
            OtherDocumentFileNames = otherDocs,
            RealEstateRegFileName = p.RealEstateRegFileName,
            BourseDataCompleted = p.BourseDataCompleted,
            BuildLicenseNumber = p.BuildLicenseNumber,
            SubdivisionRecordNumber = p.SubdivisionRecordNumber,
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

    public static WorkOrderListItemDto ToListItem(WorkOrder entity)
    {
        var bourseDone = entity.Properties.Count(p => p.BourseDataCompleted);
        return new WorkOrderListItemDto
        {
            PoNumber = entity.PoNumber,
            AssignmentType = AssignmentTypeLabels.ToLabel(entity.AssignmentType),
            PropertyCount = entity.Properties.Count,
            ExpectedPropertyCount = entity.ExpectedPropertyCount,
            CompletedCount = bourseDone,
            Status = WorkOrderListStatus.FromWorkOrder(entity),
            PromulgationDate = entity.PromulgationDate.ToString("yyyy-MM-dd"),
            ReceivedFromEnfathAt = entity.ReceivedFromEnfathAt.ToString("yyyy-MM-dd"),
            DueDateAt = entity.DueDateAt.ToString("yyyy-MM-dd"),
            AssignmentSpecialist = entity.AssignmentSpecialist ?? "",
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
            TaskNumber = p.TaskNumber,
            AssignmentType = AssignmentTypeLabels.ToLabel(p.WorkOrder.AssignmentType),
            ReceivedFromEnfathAt = p.WorkOrder.ReceivedFromEnfathAt.ToString("yyyy-MM-dd"),
            DueDateAt = p.WorkOrder.DueDateAt.ToString("yyyy-MM-dd"),
        };
    }

    public static PriorDeedRegistrationDto ToPriorDeedDto(WorkOrderProperty p, string poNumber)
    {
        return new PriorDeedRegistrationDto
        {
            PoNumber = poNumber,
            DeedDate = p.DeedDate,
            OwnerName = p.OwnerName,
            Contacts = p.Contacts
                .OrderBy(c => c.SortOrder)
                .Select(c => new PropertyContactDto
                {
                    Name = c.Name,
                    Role = c.Role,
                    Phone = c.Phone,
                })
                .ToList(),
            City = p.City,
            District = p.District,
            Classification = p.Classification,
            PropertyType = p.PropertyType,
            Area = p.Area,
            DeedStatus = p.DeedStatus,
            RestrictionsPresent = p.RestrictionsPresent,
            BoundariesAvailability = p.BoundariesAvailability,
            BoundariesExternalDocName = p.BoundariesExternalDocName,
            NorthBoundary = p.NorthBoundary,
            NorthBoundaryLengthM = p.NorthBoundaryLengthM,
            SouthBoundary = p.SouthBoundary,
            SouthBoundaryLengthM = p.SouthBoundaryLengthM,
            EastBoundary = p.EastBoundary,
            EastBoundaryLengthM = p.EastBoundaryLengthM,
            WestBoundary = p.WestBoundary,
            WestBoundaryLengthM = p.WestBoundaryLengthM,
            BuildLicenseNumber = p.BuildLicenseNumber,
            SubdivisionRecordNumber = p.SubdivisionRecordNumber,
        };
    }

    public static CourtCatalogEntryDto ToCourtDto(CourtCatalogEntry e)
    {
        var circuits = JsonSerializer.Deserialize<List<string>>(e.CircuitsJson) ?? [];
        return new CourtCatalogEntryDto
        {
            Id = e.Id,
            City = e.City,
            Court = e.Court,
            Circuits = circuits,
        };
    }
}
