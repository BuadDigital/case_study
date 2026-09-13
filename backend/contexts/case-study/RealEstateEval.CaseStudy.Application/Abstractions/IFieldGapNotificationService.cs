using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Valuation-report fields printed empty: who supplies each kind of property information, and a
/// notification to that person only.
/// </summary>
public interface IFieldGapNotificationService
{
    Task<(FieldGapSourcesDto? Sources, string? Error)> GetSourcesAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken);

    Task<(int NotifiedCount, string RecipientName, string? Error)> NotifyAsync(
        string poNumber,
        Guid propertyId,
        NotifyIntakeFieldGapRequest request,
        string? actorDisplayName,
        CancellationToken cancellationToken);
}
