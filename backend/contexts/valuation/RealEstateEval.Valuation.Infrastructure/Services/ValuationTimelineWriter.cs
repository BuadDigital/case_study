using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Sends the report cycle's milestones to the property timeline. The PO number is looked up from the property
/// (Case Study owns it); an unknown PO or a failed post drops the milestone and never fails the business step.
/// </summary>
public sealed class ValuationTimelineWriter(
    IPropertyTimelineRecorder recorder,
    IPropertyPoNumberLookup poLookup)
{
    /// <summary>
    /// Records a milestone whose PO number the caller already holds.
    /// How it works: hands the request to the recorder (an HTTP post to Case Study, which owns the timeline).
    /// Edge cases: best effort — any failure except cancellation is swallowed, so a lost milestone never fails the
    /// recall or report step that produced it.
    /// </summary>
    public async Task WriteKnownAsync(PropertyTimelineRecordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await recorder.RecordAsync(request, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // best-effort: the milestone is lost, the recall stands
        }
    }

    /// <summary>
    /// Records a milestone for a property when only the property id is known.
    /// How it works: resolves the PO number of the property, builds the request with it (<paramref name="build"/>),
    /// and records it.
    /// Edge cases: an unknown PO number silently drops the milestone; any failure except cancellation is
    /// swallowed (best effort), so the report step (draft sent, approval, deposit, new version) always stands.
    /// </summary>
    public async Task WriteAsync(
        Guid propertyId,
        Func<string, PropertyTimelineRecordRequest> build,
        CancellationToken cancellationToken)
    {
        try
        {
            var po = await poLookup.ResolveForPropertyAsync(propertyId.ToString("D"), cancellationToken);
            if (string.IsNullOrWhiteSpace(po)) return;
            await recorder.RecordAsync(build(po), cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // best-effort: the milestone is lost, the report step stands
        }
    }
}
