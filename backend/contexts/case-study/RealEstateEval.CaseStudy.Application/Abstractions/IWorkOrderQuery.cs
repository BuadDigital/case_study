using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

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

 /// <summary>Filtered / sorted plain list. Paging members of the query are ignored here.</summary>
    Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

 /// <summary>Filtered / sorted page. Visibility is applied before the count.</summary>
    Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// KPI counters over the same filtered, visibility-narrowed set as the list. Paging and sort
    /// members of the query are ignored. See docs/architecture/pagination-contract.md.
    /// </summary>
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

    /// <summary>The deeds waiting on the bourse inquiry a page at a time, with the total.</summary>
    Task<PagedResultDto<PendingBoursePropertyDto>> ListPendingBoursePagedAsync(
        int? page,
        int? pageSize,
        CancellationToken cancellationToken);

    Task<WorkOrderDto> WithResolvedSpecialistAsync(
        WorkOrderDto dto,
        CancellationToken cancellationToken = default);
}
