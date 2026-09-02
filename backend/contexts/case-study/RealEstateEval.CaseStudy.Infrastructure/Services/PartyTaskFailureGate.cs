using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>Adapts the Failures owner lookup to Case Study's documentary-gate port.</summary>
public sealed class PartyTaskFailureGate(IFailureLookup failures) : IPartyTaskFailureGate
{
    public Task<bool> HasActiveFailureAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken) =>
        failures.HasActiveAsync(poNumber, propertyId, cancellationToken);
}
