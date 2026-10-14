using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Writes a milestone onto a property's timeline from a host that does not own it (Valuation, Attachments).
/// Case Study owns the table, so the implementation posts to its dispatch route. Best-effort by contract:
/// a lost milestone must never fail the business step that produced it, so implementations do not throw.
/// </summary>
public interface IPropertyTimelineRecorder
{
    Task RecordAsync(
        PropertyTimelineRecordRequest request,
        CancellationToken cancellationToken = default);
}
