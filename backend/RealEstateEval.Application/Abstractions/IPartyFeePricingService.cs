using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPartyFeePricingService
{
    Task<PartyFeePricingDto> GetAsync(CancellationToken cancellationToken = default);

    Task<PartyFeePricingDto> SaveAsync(
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default);

    Task<decimal> ResolveDefaultFeeAsync(
        string taskKind,
        string partyType,
        CancellationToken cancellationToken = default);
}
