using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Who may write a valuation: only the appraiser assigned to the property's appraisal task — no
/// supervisor or CDO override. The report draft actions and every valuation-work write share it.
/// </summary>
public interface IAssignedAppraiserCheck
{
    /// <summary>The property's latest non-cancelled appraisal task; null when none or Case Study cannot be read.</summary>
    Task<CaseStudyWorkflowTaskSnapshotDto?> FindAppraisalTaskAsync(Guid propertyId, CancellationToken cancellationToken);

    Task<bool> IsAssignedToPropertyAsync(
        Guid propertyId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken);

    /// <summary>False when the request is missing or the caller is not its assigned appraiser.</summary>
    Task<bool> IsAssignedToRequestAsync(
        Guid valuationRequestId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken);
}
