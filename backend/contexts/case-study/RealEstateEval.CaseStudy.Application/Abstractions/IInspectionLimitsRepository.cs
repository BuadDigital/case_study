using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the inspection-limits use case (Decision 24 + Q-7). The use case in
/// <c>CaseStudy.Application</c> composes these calls; only the Infrastructure adapter opens EF.
/// </summary>
public interface IInspectionLimitsRepository
{
    /// <summary>
    /// The property on <paramref name="poNumber"/> with its work order loaded, or null when it
    /// does not exist. <paramref name="track"/> keeps the entity attached so the caller's edits
    /// are persisted by <see cref="SaveChangesAsync"/>.
    /// </summary>
    Task<WorkOrderProperty?> GetPropertyAsync(
        string poNumber,
        Guid propertyId,
        bool track,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
