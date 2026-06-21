using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IInternalDelegationLettersService
{
    Task<IReadOnlyList<InternalDelegationLetterDto>> GetForPoAsync(
        string poNumber,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InternalDelegationLetterDto>> SaveAsync(
        SaveInternalDelegationLettersRequest request,
        CancellationToken cancellationToken = default);
}
