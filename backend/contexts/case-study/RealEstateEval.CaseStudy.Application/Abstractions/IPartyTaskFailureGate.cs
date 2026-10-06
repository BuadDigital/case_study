namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Case Study's view of the Failures context for documentary gates: is there an active
/// failure on this PO / property? The adapter talks to the Failures owner API.
/// </summary>
public interface IPartyTaskFailureGate
{
    Task<bool> HasActiveFailureAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Whether an active failure still freezes the engineering-survey work on the property — false
    /// once the case specialist lifted the freeze, even though the failure itself stays active.
    /// </summary>
    Task<bool> HasSurveyFreezingFailureAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken);
}
