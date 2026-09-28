using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>The appraiser's decision on each «مستند ذو قيمة»: no effect, an approach indicator, or an addition.</summary>
public interface IValuationValueDocumentService
{
    Task<ValuationValueDocumentsDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

    Task<(ValuationValueDocumentsDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationValueDocumentsRequest request,
        CancellationToken cancellationToken = default);
}
