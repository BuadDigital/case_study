using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Abstractions;

/// <summary>
/// Resolves user display names for key-envelope DTOs (created-by, handoffs, timeline).
/// </summary>
public interface IKeyEnvelopePeopleResolver
{
    Task<KeyEnvelopeDto> WithResolvedPeopleAsync(
        KeyEnvelopeDto dto,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<KeyEnvelopeDto>> WithResolvedPeopleAsync(
        IReadOnlyList<KeyEnvelopeDto> rows,
        CancellationToken cancellationToken = default);

    Task<string> ResolveActorDisplayNameAsync(
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default);

    Task<string> ResolvePartyLabelAsync(
        string? label,
        string? userId,
        CancellationToken cancellationToken = default);
}
