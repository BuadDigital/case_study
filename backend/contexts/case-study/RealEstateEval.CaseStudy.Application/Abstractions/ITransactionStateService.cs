using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Transaction state machine — derived from party states + complete Enfaz upload.</summary>
public interface ITransactionStateService
{
    Task<TransactionStateDto?> GetStateAsync(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken cancellationToken = default);

 /// <summary>Second conclusion: complete delivery after Deposit Certificate and completion of the parties.</summary>
    Task<(TransactionStateDto? Result, string? Error)> RecordEnfazHandoverAsync(
        Guid workOrderId,
        Guid propertyId,
        string? recordedByUserId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// The accountant marks a handed-over deed «جاهز للفوترة» once its financial data appeared on Enfaz.
 /// Idempotent; refused for a deed that is not handed over.
 /// </summary>
    Task<(TransactionStateDto? Result, string? Error)> MarkBillingReadyAsync(
        Guid workOrderId,
        Guid propertyId,
        string? markedByUserId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// The case specialist takes a handed-over transaction back from Enfaz: clears the handover
 /// stamp and, as chosen, reopens the case-study report (and records the valuation request).
 /// Errors carry Arabic field messages (<c>reason</c>, or <c>_</c>).
 /// </summary>
    Task<(TransactionStateDto? Result, Dictionary<string, string>? Errors)> ReturnFromEnfazAsync(
        Guid workOrderId,
        Guid propertyId,
        ReturnFromEnfazRequest request,
        CaseStudyReportActor actor,
        CancellationToken cancellationToken = default);
}
