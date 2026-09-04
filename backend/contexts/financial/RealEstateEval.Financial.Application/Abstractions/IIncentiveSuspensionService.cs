using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Contracts;

namespace RealEstateEval.Financial.Application.Abstractions;

public interface IIncentiveSuspensionService
{
    Task<IReadOnlyList<IncentiveSuspensionDto>> ListAsync(
        string? transactionKey = null,
        string? assigneeId = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered / sorted plain list. Paging members of the query are ignored here.</summary>
    Task<IReadOnlyList<IncentiveSuspensionDto>> ListAsync(
        IncentiveSuspensionListQuery query,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered / sorted page. See docs/architecture/pagination-contract.md §7.</summary>
    Task<PagedResultDto<IncentiveSuspensionDto>> ListPagedAsync(
        IncentiveSuspensionListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

    Task<(IncentiveSuspensionDto? Row, string? Error)> CreateAsync(
        CreateIncentiveSuspensionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(IncentiveSuspensionDto? Row, string? Error)> LiftAsync(
        Guid id,
        string actorUserId,
        CancellationToken cancellationToken = default);

}
