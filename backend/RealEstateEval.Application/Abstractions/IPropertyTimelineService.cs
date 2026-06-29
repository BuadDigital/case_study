using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPropertyTimelineService
{
    Task<IReadOnlyList<PropertyTimelineEventDto>> GetForPropertyAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task RecordAsync(
        string poNumber,
        Guid propertyId,
        string eventKey,
        string title,
        string? detail,
        string tone,
        DateTime occurredAtUtc,
        CancellationToken cancellationToken = default);

    Task RecordManyAsync(
        IReadOnlyList<PropertyTimelineRecordRequest> events,
        CancellationToken cancellationToken = default);
}
