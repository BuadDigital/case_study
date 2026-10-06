using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Q-9: transaction state machine — derived from party states + complete Enfaz upload.</summary>
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

 /// <summary>
 /// Supplemental Q-9 (R3): After uploading Enfaz — Audit Entry with Decision General Manager and his reason exclusively;
 /// It does not open anything (actual retrieval from Enfaz passes R2 in evaluation).
 /// </summary>
    Task<string?> RecordPostEnfazDecisionAsync(
        Guid workOrderId,
        Guid propertyId,
        PostEnfazDecisionRequest request,
        string? actorId,
        string? actorRole,
        CancellationToken cancellationToken = default);
}
