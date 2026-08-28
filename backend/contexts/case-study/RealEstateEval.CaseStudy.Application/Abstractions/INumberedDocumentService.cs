using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// سجل المستندات المرقّمة (قرار 25 + ورشة الترقيم): تخصيص أرقام الخطابات (LT)
/// وتقارير دراسة الحالة (CS) وقيدها في السجل لحظة الطباعة/الإصدار.
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
