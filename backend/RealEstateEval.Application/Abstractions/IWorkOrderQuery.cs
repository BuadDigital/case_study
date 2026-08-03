using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>Read models for work orders and properties (visibility applied).</summary>
public interface IWorkOrderQuery
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

    Task<IReadOnlyList<PendingBoursePropertyDto>> ListPendingBourseAsync(
        CancellationToken cancellationToken);

    Task<WorkOrderDto> WithResolvedSpecialistAsync(
        WorkOrderDto dto,
        CancellationToken cancellationToken = default);
}
