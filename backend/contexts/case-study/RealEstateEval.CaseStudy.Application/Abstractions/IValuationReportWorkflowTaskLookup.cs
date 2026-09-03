namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// The one read the <c>ValuationReportSubmitted</c> handler needs: which property-appraisal task
/// is still open for a property. Keeps the integration handler off the persistence session.
/// </summary>
public interface IValuationReportWorkflowTaskLookup
{
    /// <summary>
    /// Id of the most recently updated open (not completed / cancelled) property-appraisal task
    /// for <paramref name="propertyId"/>, or null when there is none.
    /// </summary>
    Task<Guid?> FindOpenAppraisalTaskIdAsync(Guid propertyId, CancellationToken cancellationToken);
}
