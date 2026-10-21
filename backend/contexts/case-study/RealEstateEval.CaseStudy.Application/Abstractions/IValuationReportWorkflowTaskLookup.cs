namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// The reads the <c>ValuationReportSubmitted</c> handler needs: which property-appraisal task
/// is still open for a property and whether the appraiser handed his package over, and which
/// other deeds share the property's transaction (phase 5: one valuation closes them all). Keeps
/// the integration handler off the persistence session.
/// </summary>
public interface IValuationReportWorkflowTaskLookup
{
    /// <summary>
    /// The most recently updated open (not completed / cancelled) property-appraisal task for
    /// <paramref name="propertyId"/>, or null when there is none.
    /// </summary>
    Task<OpenAppraisalTaskRef?> FindOpenAppraisalTaskAsync(Guid propertyId, CancellationToken cancellationToken);

    /// <summary>
    /// The other live deeds of the property's transaction (the property itself excluded); empty
    /// for an ordinary one-deed property.
    /// </summary>
    Task<IReadOnlyList<Guid>> ListSiblingDeedIdsAsync(Guid propertyId, CancellationToken cancellationToken);
}

/// <param name="TaskId">The open appraisal task.</param>
/// <param name="PoNumber">Its purchase order, for the timeline entry.</param>
/// <param name="PackageSubmitted">The appraiser's package is submitted (the lock the final issuance closes).</param>
public sealed record OpenAppraisalTaskRef(Guid TaskId, string PoNumber, bool PackageSubmitted);
