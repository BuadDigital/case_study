namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Case Study writes used by Financial (D4 document counters; survey-area backfill).
/// The Case Study host uses EF; Financial calls HTTP. Do not open Case Study EF on Financial.
/// Failure side effects live on <see cref="ICaseStudyFailureCommands"/>.
/// </summary>
public interface ICaseStudyCommands
{
    Task<(string? Reference, string? Error)> AllocateDocumentReferenceAsync(
        string dept,
        string type,
        string dateKey,
        CancellationToken cancellationToken = default);

    Task BackfillPropertyAreaIfEmptyAsync(
        Guid propertyId,
        decimal areaM2,
        CancellationToken cancellationToken = default);
}
