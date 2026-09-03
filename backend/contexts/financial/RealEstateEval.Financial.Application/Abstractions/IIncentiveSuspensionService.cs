using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Financial.Application.Abstractions;

public interface IIncentiveSuspensionService
{
    Task<IReadOnlyList<IncentiveSuspensionDto>> ListAsync(
        string? transactionKey = null,
        string? assigneeId = null,
        bool activeOnly = true,
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
