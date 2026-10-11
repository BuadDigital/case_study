using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IPropertyComparableLinkService
{
    Task<PropertyComparableLinkListDto> ListAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);
}
