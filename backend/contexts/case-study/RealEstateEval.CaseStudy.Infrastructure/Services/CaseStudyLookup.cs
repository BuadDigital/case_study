using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public sealed class CaseStudyLookup(ICaseStudyRepository caseStudy) : ICaseStudyLookup
{
    public async Task<IReadOnlyList<Guid>> ListCompletedCaseStudyPropertyIdsAsync(
        CancellationToken cancellationToken = default) =>
        await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(task =>
                task.Kind == WorkflowTaskKind.CaseStudyProperty
                && task.Status == WorkflowTaskStatus.Completed
                && task.PropertyId != null)
            .Select(task => task.PropertyId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, WorkflowTaskKind>> GetWorkflowTaskKindsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default)
    {
        if (taskIds.Count == 0)
            return new Dictionary<Guid, WorkflowTaskKind>();

        return await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(task => taskIds.Contains(task.Id))
            .ToDictionaryAsync(task => task.Id, task => task.Kind, cancellationToken);
    }

    public async Task<IReadOnlyList<CaseStudyWorkOrderSummaryDto>> ListWorkOrderSummariesAsync(
        CancellationToken cancellationToken = default) =>
        await caseStudy.WorkOrders.AsNoTracking()
            .OrderByDescending(w => w.CreatedAtUtc)
            .ThenBy(w => w.PoNumber)
            .Select(w => new CaseStudyWorkOrderSummaryDto
            {
                Id = w.Id,
                PoNumber = w.PoNumber.Trim(),
                PropertyCount = w.Properties.Count,
                CreatedAtUtc = w.CreatedAtUtc,
                ReceivedFromEnfathAtUtc = w.ReceivedFromEnfathAt.ToDateTime(TimeOnly.MinValue),
            })
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<string>> ListPoNumbersByAssigneesAsync(
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken = default)
    {
        var ids = assigneeIds
            .Select(id => id.Trim())
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (ids.Count == 0)
            return [];

        var pos = await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => t.AssigneeId != null && ids.Contains(t.AssigneeId))
            .Where(t => t.PoNumber != null && t.PoNumber != "")
            .Select(t => t.PoNumber)
            .Distinct()
            .ToListAsync(cancellationToken);

        return pos
            .Select(p => p.Trim())
            .Where(p => p.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    public async Task<CaseStudyPropertySnapshotDto?> GetPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var property = await caseStudy.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(p => p.Id == propertyId && !p.IsRemoved, cancellationToken);
        return property is null ? null : ToSnapshot(property);
    }

    public async Task<CaseStudyValuationPropertyContextDto?> GetValuationPropertyContextAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        // No IsRemoved filter: report fill / issuance must keep working on soft-removed rows.
        var property = await caseStudy.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .Include(p => p.BuildingInventoryLines)
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
        if (property is null)
            return null;

        var workspace = await caseStudy.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => w.PropertyId == propertyId)
            .OrderByDescending(w => w.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        string? inspectorPayloadJson = null;
        if (workspace is not null)
        {
            inspectorPayloadJson = await caseStudy.PartyTaskSubmissions.AsNoTracking()
                .Where(s => s.Id == workspace.PartyTaskSubmissionId)
                .Select(s => s.PayloadJson)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var deedNatureMatchOutcome = await caseStudy.CaseStudyForms.AsNoTracking()
            .Where(f => f.PropertyId == propertyId && !f.IsPartyForm)
            .OrderByDescending(f => f.UpdatedAtUtc)
            .Select(f => f.DeedNatureMatchOutcome)
            .FirstOrDefaultAsync(cancellationToken);

        string? clientNameAr = null;
        string? clientNameEn = null;
        IReadOnlyList<string> reportUserNames = [];
        if (property.WorkOrder is { } workOrder)
        {
            var reportUserIds = WorkOrderReportUsers.Parse(workOrder.ReportUserClientIdsJson);
            var lookupIds = reportUserIds.ToList();
            if (workOrder.ClientId is { } cid)
                lookupIds.Add(cid);
            if (lookupIds.Count > 0)
            {
                var clients = await caseStudy.Clients.AsNoTracking()
                    .Where(c => lookupIds.Contains(c.Id))
                    .ToDictionaryAsync(c => c.Id, cancellationToken);
                if (workOrder.ClientId is { } clientId
                    && clients.TryGetValue(clientId, out var client))
                {
                    clientNameAr = client.NameAr;
                    clientNameEn = client.NameEn;
                }

                reportUserNames = reportUserIds
                    .Select(id => clients.GetValueOrDefault(id)?.NameAr)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Select(name => name!)
                    .ToList();
            }
        }

        return new CaseStudyValuationPropertyContextDto
        {
            Id = property.Id,
            WorkOrderId = property.WorkOrderId,
            PoNumber = property.WorkOrder?.PoNumber.Trim() ?? "",
            AssignmentType = property.WorkOrder is { } wo
                ? AssignmentTypeLabels.ToLabel(wo.AssignmentType)
                : "",
            DeedKind = property.DeedKind.ToString(),
            DeedNumber = property.DeedNumber,
            DeedDate = property.DeedDate,
            OwnerName = property.OwnerName,
            DeedOwnersJson = property.DeedOwnersJson,
            OwnershipType = property.OwnershipType,
            OwnershipTypeIsManual = property.OwnershipTypeIsManual,
            RestrictionsPresent = property.RestrictionsPresent,
            RestrictionType = property.RestrictionType,
            RestrictionOtherReason = property.RestrictionOtherReason,
            City = property.City,
            Region = property.Region,
            District = property.District,
            Area = property.Area,
            Classification = property.Classification,
            PropertyType = property.PropertyType,
            PlanNumber = property.PlanNumber,
            PlanName = property.PlanName,
            PlotNumber = property.PlotNumber,
            BlockNumber = property.BlockNumber,
            PartitionMinutesNumber = property.PartitionMinutesNumber,
            PartitionMinutesDate = property.PartitionMinutesDate,
            NorthBoundary = property.NorthBoundary,
            NorthBoundaryLengthM = property.NorthBoundaryLengthM,
            NorthBoundaryType = property.NorthBoundaryType,
            NorthFacadeFinishing = property.NorthFacadeFinishing,
            SouthBoundary = property.SouthBoundary,
            SouthBoundaryLengthM = property.SouthBoundaryLengthM,
            SouthBoundaryType = property.SouthBoundaryType,
            SouthFacadeFinishing = property.SouthFacadeFinishing,
            EastBoundary = property.EastBoundary,
            EastBoundaryLengthM = property.EastBoundaryLengthM,
            EastBoundaryType = property.EastBoundaryType,
            EastFacadeFinishing = property.EastFacadeFinishing,
            WestBoundary = property.WestBoundary,
            WestBoundaryLengthM = property.WestBoundaryLengthM,
            WestBoundaryType = property.WestBoundaryType,
            WestFacadeFinishing = property.WestFacadeFinishing,
            FinishingType = property.FinishingType,
            FinishingStructure = property.FinishingStructure,
            HasStructuresToValue = property.HasStructuresToValue,
            InspectionScopeKey = property.InspectionScopeKey,
            InspectionRestrictionReason = property.InspectionRestrictionReason,
            UninspectedUnitsJson = property.UninspectedUnitsJson,
            RemoteInspectionApprovedAtUtc = property.RemoteInspectionApprovedAtUtc,
            BuildingInventoryLines = property.BuildingInventoryLines
                .OrderBy(line => line.SortOrder)
                .Select(line => new CaseStudyBuildingInventoryLineDto
                {
                    SortOrder = line.SortOrder,
                    StructureKind = line.StructureKind,
                    Label = line.Label,
                    AreaSqm = line.AreaSqm,
                })
                .ToList(),
            LatestWorkspace = workspace is null
                ? null
                : new CaseStudyInspectionWorkspaceDto
                {
                    WorkflowTaskId = workspace.WorkflowTaskId,
                    PartyTaskSubmissionId = workspace.PartyTaskSubmissionId,
                    InspectionDate = workspace.InspectionDate,
                    MapLatitude = workspace.MapLatitude,
                    MapLongitude = workspace.MapLongitude,
                    UpdatedAtUtc = workspace.UpdatedAtUtc,
                },
            InspectorPayloadJson = inspectorPayloadJson,
            DeedNatureMatchOutcome = deedNatureMatchOutcome,
            ClientNameAr = clientNameAr,
            ClientNameEn = clientNameEn,
            ReportUserClientNamesAr = reportUserNames,
        };
    }

    public async Task<CaseStudyPropertySnapshotDto?> GetPropertyByPoAndDeedAsync(
        string poNumber,
        string deedNumber,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var deed = deedNumber.Trim();
        if (po.Length == 0 || deed.Length == 0)
            return null;

        var property = await caseStudy.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(
                p => !p.IsRemoved
                     && p.WorkOrder != null
                     && p.WorkOrder.PoNumber == po
                     && (p.DeedNumber == deed || p.Id.ToString() == deed),
                cancellationToken);
        return property is null ? null : ToSnapshot(property);
    }

    public async Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default)
    {
        if (poNumbers.Count == 0)
            return [];

        var rows = await caseStudy.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .Where(p => p.WorkOrder != null && poNumbers.Contains(p.WorkOrder!.PoNumber))
            .ToListAsync(cancellationToken);
        return rows.Select(ToSnapshot).ToList();
    }

    public async Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByRequestNumbersAsync(
        IReadOnlyList<string> requestNumbers,
        CancellationToken cancellationToken = default)
    {
        if (requestNumbers.Count == 0)
            return [];

        var rows = await caseStudy.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .Where(p =>
                !p.IsRemoved
                && p.RequestNumber != null
                && requestNumbers.Contains(p.RequestNumber))
            .OrderBy(p => p.WorkOrder!.PoNumber)
            .ThenBy(p => p.DeedNumber)
            .ToListAsync(cancellationToken);
        return rows.Select(ToSnapshot).ToList();
    }

    public async Task<string?> GetCaseSpecialistAssigneeAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default) =>
        await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => t.PropertyId == propertyId && t.Kind == WorkflowTaskKind.CaseStudyProperty)
            .Select(t => t.AssigneeId)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<CaseStudyGovReviewKeyStatusDto>> ListGovReviewKeyStatusesAsync(
        CancellationToken cancellationToken = default)
    {
        var govTasks = await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => t.Kind == WorkflowTaskKind.GovernmentReview && t.PropertyId != null)
            .ToListAsync(cancellationToken);
        if (govTasks.Count == 0)
            return [];

        var taskIds = govTasks.Select(t => t.Id).ToList();
        var submissions = await caseStudy.PartyTaskSubmissions.AsNoTracking()
            .Where(s =>
                s.Kind == WorkflowTaskKindValues.GovernmentReview
                && taskIds.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);

        var poNumbers = govTasks.Select(t => t.PoNumber.Trim()).Distinct().ToList();
        var properties = await caseStudy.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .Where(p => p.WorkOrder != null && poNumbers.Contains(p.WorkOrder!.PoNumber))
            .ToListAsync(cancellationToken);
        var propertyById = properties.ToDictionary(p => p.Id);

        var rows = new List<CaseStudyGovReviewKeyStatusDto>();
        foreach (var task in govTasks)
        {
            var submission = submissions.FirstOrDefault(s => s.WorkflowTaskId == task.Id);
            if (submission is null)
                continue;

            var keysStatus = ParseKeysStatus(submission.PayloadJson);
            if (!PropertyKeysStatuses.IsLegacyQueueStatus(keysStatus))
                continue;

            propertyById.TryGetValue(task.PropertyId!.Value, out var property);
            rows.Add(new CaseStudyGovReviewKeyStatusDto
            {
                PropertyId = task.PropertyId.Value,
                PoNumber = task.PoNumber.Trim(),
                PropertyOrdinal = task.PropertyOrdinal,
                AssigneeName = task.AssigneeName?.Trim() ?? "",
                KeysStatus = keysStatus,
                City = property?.City?.Trim() ?? "",
                PropertyType = property?.PropertyType?.Trim() ?? "",
                DeedNumber = property?.DeedNumber?.Trim() ?? "",
            });
        }

        return rows;
    }

    public async Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByIdsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default)
    {
        if (propertyIds.Count == 0)
            return [];

        var rows = await caseStudy.WorkOrderProperties.AsNoTracking()
            .Where(p => propertyIds.Contains(p.Id))
            .ToListAsync(cancellationToken);
        return rows.Select(ToSnapshot).ToList();
    }

    public async Task<CaseStudyWorkflowTaskSnapshotDto?> GetWorkflowTaskAsync(
        Guid taskId,
        CancellationToken cancellationToken = default)
    {
        var task = await caseStudy.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        return task is null ? null : ToTaskSnapshot(task);
    }

    public async Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByIdsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default)
    {
        if (taskIds.Count == 0)
            return [];

        var rows = await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => taskIds.Contains(t.Id))
            .ToListAsync(cancellationToken);
        return rows.Select(ToTaskSnapshot).ToList();
    }

    public async Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByPropertyAsync(
        Guid propertyId,
        IReadOnlyList<WorkflowTaskKind>? kinds = null,
        CancellationToken cancellationToken = default)
    {
        var query = caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => t.PropertyId == propertyId);
        if (kinds is { Count: > 0 })
            query = query.Where(t => kinds.Contains(t.Kind));

        var rows = await query.ToListAsync(cancellationToken);
        return rows.Select(ToTaskSnapshot).ToList();
    }

    public async Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByKindsAsync(
        IReadOnlyList<WorkflowTaskKind> kinds,
        CancellationToken cancellationToken = default)
    {
        if (kinds.Count == 0)
            return [];

        var rows = await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => kinds.Contains(t.Kind))
            .ToListAsync(cancellationToken);
        return rows.Select(ToTaskSnapshot).ToList();
    }

    public async Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default)
    {
        if (poNumbers.Count == 0)
            return [];

        var rows = await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => poNumbers.Contains(t.PoNumber))
            .ToListAsync(cancellationToken);
        return rows.Select(ToTaskSnapshot).ToList();
    }

    public async Task<IReadOnlyList<CaseStudyPartyTaskSubmissionSnapshotDto>> ListPartyTaskSubmissionsByTaskIdsAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default)
    {
        if (workflowTaskIds.Count == 0)
            return [];

        return await caseStudy.PartyTaskSubmissions.AsNoTracking()
            .Where(s => workflowTaskIds.Contains(s.WorkflowTaskId))
            .Select(s => new CaseStudyPartyTaskSubmissionSnapshotDto
            {
                WorkflowTaskId = s.WorkflowTaskId,
                Status = s.Status,
                PayloadJson = s.PayloadJson,
                SubmittedAtUtc = s.SubmittedAtUtc,
                UpdatedAtUtc = s.UpdatedAtUtc,
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CaseStudyFieldInspectionWorkspaceSnapshotDto>> ListFieldInspectionWorkspacesByTaskIdsAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default)
    {
        if (workflowTaskIds.Count == 0)
            return [];

        return await caseStudy.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => workflowTaskIds.Contains(w.WorkflowTaskId))
            .Select(w => new CaseStudyFieldInspectionWorkspaceSnapshotDto
            {
                WorkflowTaskId = w.WorkflowTaskId,
                Status = w.Status,
                SubmittedAtUtc = w.SubmittedAtUtc,
                UpdatedAtUtc = w.UpdatedAtUtc,
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<Guid?> GetWorkOrderIdByPoNumberAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0)
            return null;

        return await caseStudy.WorkOrders.AsNoTracking()
            .Where(w => w.PoNumber == po)
            .Select(w => (Guid?)w.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<string, DateTime?>> GetWorkOrderReceivedAtByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default)
    {
        if (poNumbers.Count == 0)
            return new Dictionary<string, DateTime?>(StringComparer.Ordinal);

        var rows = await caseStudy.WorkOrders.AsNoTracking()
            .Where(w => poNumbers.Contains(w.PoNumber))
            .Select(w => new
            {
                PoNumber = w.PoNumber.Trim(),
                Received = (DateTime?)w.ReceivedFromEnfathAt.ToDateTime(TimeOnly.MinValue),
            })
            .ToListAsync(cancellationToken);
        return rows.ToDictionary(r => r.PoNumber, r => r.Received, StringComparer.Ordinal);
    }

    public async Task<IReadOnlyList<CaseStudyWorkOrderBillingSnapshotDto>> ListWorkOrdersForBillingAsync(
        int take,
        CancellationToken cancellationToken = default)
    {
        var limit = Math.Clamp(take, 1, 500);
        var orders = await caseStudy.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ThenBy(w => w.PoNumber)
            .Take(limit)
            .ToListAsync(cancellationToken);
        return orders.Select(ToBilling).ToList();
    }

    public async Task<CaseStudyWorkOrderBillingSnapshotDto?> GetWorkOrderForBillingAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0)
            return null;

        var order = await caseStudy.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .FirstOrDefaultAsync(w => w.PoNumber == po, cancellationToken);
        return order is null ? null : ToBilling(order);
    }

    private static CaseStudyWorkOrderBillingSnapshotDto ToBilling(WorkOrder order) => new()
    {
        Id = order.Id,
        PoNumber = order.PoNumber.Trim(),
        CreatedAtUtc = order.CreatedAtUtc,
        ReceivedFromEnfathAtUtc = order.ReceivedFromEnfathAt.ToDateTime(TimeOnly.MinValue),
        Properties = order.Properties.Select(ToSnapshot).ToList(),
    };

    private static CaseStudyWorkflowTaskSnapshotDto ToTaskSnapshot(WorkflowTask task) => new()
    {
        Id = task.Id,
        Kind = task.Kind.ToDbValue(),
        Status = task.Status.ToDbValue(),
        PoNumber = task.PoNumber.Trim(),
        PropertyId = task.PropertyId,
        PropertyOrdinal = task.PropertyOrdinal,
        AssigneeId = task.AssigneeId,
        UpdatedAtUtc = task.UpdatedAtUtc,
    };

    private static CaseStudyPropertySnapshotDto ToSnapshot(WorkOrderProperty property) => new()
    {
        Id = property.Id,
        PoNumber = property.WorkOrder?.PoNumber?.Trim() ?? "",
        DeedNumber = property.DeedNumber?.Trim() ?? "",
        RequestNumber = property.RequestNumber?.Trim() ?? "",
        OwnerName = property.OwnerName?.Trim() ?? "",
        City = property.City?.Trim() ?? "",
        District = property.District?.Trim() ?? "",
        Court = property.Court?.Trim() ?? "",
        Circuit = property.Circuit?.Trim() ?? "",
        PropertyType = property.PropertyType?.Trim() ?? "",
        DeedStatus = property.DeedStatus,
        IsRemoved = property.IsRemoved,
        WorkOrderId = property.WorkOrderId,
        Area = property.Area,
        BourseCompletedAtUtc = property.BourseCompletedAtUtc,
    };

    private static string? ParseKeysStatus(string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("keysStatus", out var prop))
                return null;
            var value = prop.GetString()?.Trim();
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
