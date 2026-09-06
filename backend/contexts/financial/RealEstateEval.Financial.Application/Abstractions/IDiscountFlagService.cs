using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Contracts;

namespace RealEstateEval.Financial.Application.Abstractions;

public interface IDiscountFlagService
{
    Task<IReadOnlyList<DiscountFlagDto>> ListAsync(
        string? transactionKey = null,
        string? status = null,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered / sorted plain list. Paging members of the query are ignored here.</summary>
    Task<IReadOnlyList<DiscountFlagDto>> ListAsync(
        DiscountFlagListQuery query,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered / sorted page. See docs/architecture/pagination-contract.md §7.</summary>
    Task<PagedResultDto<DiscountFlagDto>> ListPagedAsync(
        DiscountFlagListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

    Task<(DiscountFlagDto? Row, string? Error)> CreateAsync(
        CreateDiscountFlagRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(DiscountFlagDto? Row, string? Error)> ApproveAsync(
        Guid id,
        ResolveDiscountFlagRequest request,
        string actorUserId,
        string? actorDepartment,
        bool canManageAllDepartments,
        CancellationToken cancellationToken = default);

    Task<(DiscountFlagDto? Row, string? Error)> RejectAsync(
        Guid id,
        ResolveDiscountFlagRequest request,
        string actorUserId,
        string? actorDepartment,
        bool canManageAllDepartments,
        CancellationToken cancellationToken = default);
}
