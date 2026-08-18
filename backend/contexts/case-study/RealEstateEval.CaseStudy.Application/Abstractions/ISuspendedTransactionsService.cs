using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface ISuspendedTransactionsService
{
    Task<IReadOnlyList<SuspendedTransactionDto>> ListAsync(
        CancellationToken cancellationToken = default);
}
