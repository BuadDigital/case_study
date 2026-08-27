using RealEstateEval.Application.Contracts;
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
    Task<IReadOnlyList<WorkOrderDto>> ListDetailsAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PropertyListItemDto>> ListPropertyListItemsAsync(
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
    Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateWorkOrderRequest request,
        CancellationToken cancellationToken);
    Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> UpdateHeaderAsync(
        string poNumber,
        UpdateWorkOrderHeaderRequest request,
        CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> DeleteAsync(string poNumber, CancellationToken cancellationToken);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> AddPropertyAsync(
        string poNumber,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateLocationMapUrlAsync(
        string poNumber,
        Guid propertyId,
        string? locationMapUrl,
        CancellationToken cancellationToken);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> DeletePropertyAsync(
        string poNumber,
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> CancelAsync(string poNumber, CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> StopAsync(string poNumber, CancellationToken cancellationToken);
}
