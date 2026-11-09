using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Merge / unmerge of transactions — the case-study specialist's decision, audited.</summary>
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

    /// <summary>«إرسال المعاملة للدراسة» of the deed's transaction by coordination (ruling 2026-11-02).</summary>
    Task<(TransactionReceiptDto? Result, string? Error)> ReceiveAsync(
        Guid propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>The deliveries the deed's transaction awaits from outside the system (Omar 2026-11-08).</summary>
    Task<IReadOnlyList<TransactionExternalReceiptDto>?> ListExternalReceiptsAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    /// <summary>«إضافة استلام من طرف خارجي» — coordination, before the transaction is sent to the study.</summary>
    Task<(TransactionExternalReceiptDto? Result, string? Error)> AddExternalReceiptAsync(
        Guid propertyId,
        AddTransactionExternalReceiptRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>The external delivery arrived («تم الاستلام»), or is no longer awaited (<paramref name="received"/> false).</summary>
    Task<(TransactionExternalReceiptDto? Result, string? Error)> CloseExternalReceiptAsync(
        Guid receiptId,
        bool received,
        CloseTransactionExternalReceiptRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>Change the link kind of a multi-deed transaction — the stage owner (ruling 2026-11-02).</summary>
    Task<(TransactionDetailDto? Result, string? Error)> ChangeLinkKindAsync(
        Guid transactionId,
        ChangeTransactionLinkKindRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>«يعمل عليها الآن»: who opened or saved the transaction last (information only).</summary>
    Task MarkWorkingAsync(
        Guid transactionId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>Deeds matching a deed / registry / PO number for the merge dialog, with their merge state.</summary>
    Task<IReadOnlyList<TransactionDeedSearchHitDto>> SearchDeedsAsync(
        Guid targetTransactionId,
        string query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
