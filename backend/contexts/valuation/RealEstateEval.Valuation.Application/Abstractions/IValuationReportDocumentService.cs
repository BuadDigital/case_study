using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IValuationReportDocumentService
{
    Task<ValuationReportDocumentDto?> GetPreviewAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

    Task<byte[]?> GetPreviewPdfAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);
}
