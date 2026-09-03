using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Numbered-document ledger (decision 25 + numbering workshop): assign letter numbers (LT)
/// and case-study report numbers (CS) and log them at print/issue time.
/// </summary>
public interface INumberedDocumentService
{
    Task<(NumberedDocumentDto? Result, string? Error)> AllocateAsync(
        AllocateNumberedDocumentRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<NumberedDocumentDto>> ListAsync(
        string? kind,
        string? poNumber,
        CancellationToken cancellationToken = default);
}
