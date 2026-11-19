using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IWorkOrderService
{
    Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);
    Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
    Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
    Task<WorkOrderListCountsDto> CountsAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<WorkOrderDto>> ListDetailsAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PropertyListItemDto>> ListPropertyListItemsAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);

    /// <summary>The details list a page at a time, with the total (the unpaged list stops at 500).</summary>
    Task<PagedResultDto<WorkOrderDto>> ListDetailsPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);

    /// <summary>The property rows a page of work orders at a time, with the work orders' total.</summary>
    Task<PagedResultDto<PropertyListItemDto>> ListPropertyListItemsPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);
    Task<WorkOrderDto?> GetByPoNumberAsync(
        string poNumber,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(string poNumber, CancellationToken cancellationToken);
    Task<PriorDeedRegistrationDto?> FindPriorDeedAsync(
        string deedNumber,
        string? excludePoNumber,
        CancellationToken cancellationToken,
        Guid? excludePropertyId = null);
    Task<IReadOnlyList<PriorDeedRegistrationDto>> ListPriorDeedsAsync(
        string deedNumber,
        string? excludePoNumber,
        CancellationToken cancellationToken,
        Guid? excludePropertyId = null,
        int take = 20);
    Task<IReadOnlyList<PendingBoursePropertyDto>> ListPendingBourseAsync(
        CancellationToken cancellationToken);
    Task<PagedResultDto<PendingBoursePropertyDto>> ListPendingBoursePagedAsync(
        int? page,
        int? pageSize,
        CancellationToken cancellationToken);
    Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateWorkOrderRequest request,
        CancellationToken cancellationToken,
        string? actorName = null);
    Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> UpdateHeaderAsync(
        string poNumber,
        UpdateWorkOrderHeaderRequest request,
        CancellationToken cancellationToken);
    Task<WorkOrderDto?> UpdateAssignmentSpecialistAsync(
        string poNumber,
        string? assignmentSpecialist,
        CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> DeleteAsync(string poNumber, CancellationToken cancellationToken);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> AddPropertyAsync(
        string poNumber,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken,
        bool softDraft = false,
        string? actorName = null);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken,
        bool softDraft = false,
        string? actorName = null,
        PartySubmissionActor? changeActor = null);

    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateSpecialistReportExtrasAsync(
        string poNumber,
        Guid propertyId,
        string? specialistReportExtrasJson,
        CancellationToken cancellationToken,
        PartySubmissionActor? actor = null);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken,
        string? actorName = null,
        PartySubmissionActor? changeActor = null);
    Task<(bool Ok, string? Error)> DeletePropertyAsync(
        string poNumber,
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> CancelAsync(string poNumber, CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> StopAsync(string poNumber, CancellationToken cancellationToken);
}
