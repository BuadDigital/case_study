using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the building-inventory use case. The use case in
/// <c>CaseStudy.Application</c> composes these calls; only the Infrastructure adapter opens EF.
/// </summary>
public interface IBuildingInventoryRepository
{
    /// <summary>
    /// The property on <paramref name="poNumber"/> with its work order and inventory lines
    /// loaded, or null when it does not exist. <paramref name="track"/> keeps the graph attached
    /// so the caller's edits are persisted by <see cref="SaveChangesAsync"/>.
    /// </summary>
    Task<WorkOrderProperty?> GetPropertyWithLinesAsync(
        string poNumber,
        Guid propertyId,
        bool track,
        CancellationToken cancellationToken);

    /// <summary>Untracked re-read of the saved property with its inventory lines.</summary>
    Task<WorkOrderProperty> GetSavedPropertyWithLinesAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    void AddLine(BuildingInventoryLine line);

    void RemoveLines(IReadOnlyCollection<BuildingInventoryLine> lines);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
