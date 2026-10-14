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
    /// <summary>For callers that already hold the PO number.</summary>
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
