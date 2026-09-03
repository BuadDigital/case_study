using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Contracts;

namespace RealEstateEval.Financial.Application.Abstractions;

public interface IDiscountFlagService
{
    Task<IReadOnlyList<DiscountFlagDto>> ListAsync(
        string? transactionKey = null,
        string? status = null,
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
