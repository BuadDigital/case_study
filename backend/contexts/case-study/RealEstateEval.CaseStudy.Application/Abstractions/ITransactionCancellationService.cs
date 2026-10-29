using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// «إلغاء المعاملة»: the case specialist requests, the section supervisor approves or rejects and
/// may reactivate. Role checks live here so every path (controller, tests) gets the same answer.
/// </summary>
public interface ITransactionCancellationService
{
    /// <summary>What a request for this deed's transaction, or for this work order, would cancel.</summary>
    Task<(TransactionCancellationPreviewDto? Result, string? Error)> PreviewAsync(
        Guid? propertyId,
        string? poNumber,
        CancellationToken cancellationToken = default);

    /// <summary>Raises a request; a supervisor's own request is approved at once.</summary>
    Task<(TransactionCancellationDto? Result, string? Error)> RequestAsync(
        RequestTransactionCancellationRequest request,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken = default);

    Task<(TransactionCancellationDto? Result, string? Error)> ApproveAsync(
        Guid id,
        DecideTransactionCancellationRequest request,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken = default);

    Task<(TransactionCancellationDto? Result, string? Error)> RejectAsync(
        Guid id,
        DecideTransactionCancellationRequest request,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken = default);

    Task<(TransactionCancellationDto? Result, string? Error)> ReactivateAsync(
        Guid id,
        ReactivateTransactionCancellationRequest request,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>The pending request and the approved cancellation that cover this deed, if any.</summary>
    Task<TransactionCancellationStateDto> GetForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    /// <summary>Requests, newest first; a null status lists them all.</summary>
    Task<IReadOnlyList<TransactionCancellationDto>> ListAsync(
        string? status,
        CancellationToken cancellationToken = default);
}
