using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IInternalDelegationLettersService
{
    Task<IReadOnlyList<InternalDelegationLetterDto>> GetForScopeAsync(
        string scopeKey,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InternalDelegationLetterDto>> SaveAsync(
        SaveInternalDelegationLettersRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// يثبت snapshot الصفوف + المفوَّض + التاريخين، ويولّد رقماً مرجعياً ذرّياً (DS-LT-YYMMDD-NNN).
    /// </summary>
    Task<(InternalDelegationLetterDto? Letter, string? Error)> IssueAsync(
        IssueInternalDelegationLetterRequest request,
        CancellationToken cancellationToken = default);
}
