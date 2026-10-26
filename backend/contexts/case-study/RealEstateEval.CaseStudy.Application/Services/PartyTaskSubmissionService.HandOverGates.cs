using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// D2: the appraiser's hand-over waits on the valuation issuance gates he must see fixed first
/// (read from the Valuation API through the cross-service client); what the specialist completes
/// after the hand-over does not hold it up. See <see cref="AppraisalHandOverGateRules"/>.
/// </summary>
public partial class PartyTaskSubmissionService
{
    private async Task<Dictionary<string, string>?> AppraisalHandOverGateErrorsAsync(
        PartyTaskSubmission entity,
        bool studyReportListed,
        CancellationToken cancellationToken)
    {
        // Test compositions without the valuation port, or a package without a property.
        if (_valuationRequests is null || entity.PropertyId is not Guid propertyId)
            return null;
        try
        {
            var open = await _valuationRequests.GetOpenByPropertyAsync(propertyId.ToString("D"), cancellationToken);
            // No valuation request yet: nothing was valued, so there is no gate to read.
            if (open is null) return null;
            var gates = await _valuationRequests.GetIssuanceGatesAsync(open.Id, cancellationToken);
            return AppraisalHandOverGateRules.HandOverError(gates, studyReportListed);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // Fail closed: an unreadable gate never lets the hand-over through.
            return new Dictionary<string, string>
            {
                [AppraisalHandOverGateRules.ErrorKey] = AppraisalHandOverGateRules.UnverifiedAr,
            };
        }
    }
}
