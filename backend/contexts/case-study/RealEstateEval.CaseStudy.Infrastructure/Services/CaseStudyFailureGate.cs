using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Application.Contracts;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// Adapts the Failures owner lookup and commands to Case Study's documentary failure port.
/// The list-then-resolve loop lives here so the use case does not need Failures' request DTOs.
/// </summary>
public sealed class CaseStudyFailureGate(
    IFailureLookup lookup,
    IFailureService failures) : ICaseStudyFailureGate
{
    public Task<bool> HasBlockingFailureAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken) =>
        lookup.HasBlockingAsync(poNumber, propertyId, cancellationToken);

    public Task EnsureSystemFailureAsync(
        string poNumber,
        string propertyId,
        string? deedNumber,
        string problemKey,
        string problemLabel,
        string detail,
        string raisedByLabel,
        CancellationToken cancellationToken) =>
        failures.EnsureSystemInternalFailureAsync(
            poNumber,
            propertyId,
            deedNumber,
            problemKey,
            problemLabel,
            detail,
            raisedByLabel,
            cancellationToken);

    public async Task ResolveSystemFailuresAsync(
        string poNumber,
        string propertyId,
        string problemKey,
        string raiserRole,
        string resolutionReason,
        string continueInstructions,
        CancellationToken cancellationToken)
    {
        var active = await lookup.ListActiveIdsByProblemAsync(
            poNumber,
            propertyId,
            problemKey,
            raiserRole,
            cancellationToken);

        foreach (var id in active)
        {
            await failures.ResolveAsync(
                id,
                new ResolveFailureRequest
                {
                    ResolutionReason = resolutionReason,
                    ContinueInstructions = continueInstructions,
                },
                cancellationToken);
        }
    }
}
