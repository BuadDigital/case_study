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

 /// <summary>
 /// Active withhold for this assignee on this PO, if any. Used at accrual to stamp suspended.
 /// </summary>
    Task<IncentiveSuspensionDto?> FindActiveAsync(
        string assigneeId,
        string transactionKey,
        CancellationToken cancellationToken = default);
}
