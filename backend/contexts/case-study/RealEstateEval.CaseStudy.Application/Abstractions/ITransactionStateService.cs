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
