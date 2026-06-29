namespace RealEstateEval.Application.Contracts;

public sealed record PropertyTimelineRecordRequest(
    string PoNumber,
    Guid PropertyId,
    string EventKey,
    string Title,
    string? Detail,
    string Tone,
    DateTime OccurredAtUtc);
