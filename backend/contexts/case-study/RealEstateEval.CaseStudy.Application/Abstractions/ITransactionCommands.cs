using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Merge / unmerge of transactions (decision 2026-10-19) — the case-study specialist's decision, audited.</summary>
public interface ITransactionCommands
{
    Task<(TransactionDetailDto? Result, string? Error)> MergeAsync(
        Guid targetTransactionId,
        MergeTransactionsRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    Task<(TransactionDetailDto? Result, string? Error)> UnmergeDeedAsync(
        Guid transactionId,
        UnmergeTransactionDeedRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>Deeds matching a deed / registry / PO number for the merge dialog, with their merge state.</summary>
    Task<IReadOnlyList<TransactionDeedSearchHitDto>> SearchDeedsAsync(
        Guid targetTransactionId,
        string query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
