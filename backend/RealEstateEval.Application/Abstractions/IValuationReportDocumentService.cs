using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationReportDocumentService
{
    Task<ValuationReportDocumentDto?> GetPreviewAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);
}
