using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

public sealed record PricingTableSnapshot(
    Guid Id,
    string Category,
    string Name,
    string PricingKind,
    string ManagedBy,
    bool IsActive,
    decimal CourtVisitFeeSar,
    decimal FieldInspectorIndividualFeeSar,
    decimal FieldInspectorOrganizationFeeSar,
    decimal FlatAmountSar,
    IReadOnlyList<PricingTierSnapshot> AreaTiers);

public sealed record PricingTierSnapshot(
    int SortOrder,
    decimal? MaxAreaM2,
    decimal FeeSar);

public sealed record PricingAssignmentSnapshot(Guid TableId, string AssigneeId);

public static class PartyFeePricingSnapshots
{
    public static PricingTableSnapshot Snapshot(PartyFeePricingTable table) =>
        Snapshot(
            table,
            table.AreaTiers
                .OrderBy(t => t.SortOrder)
                .Select(t => new PricingTierSnapshot(t.SortOrder, t.MaxAreaM2, t.FeeSar))
                .ToList());

    public static PricingTableSnapshot Snapshot(
        PartyFeePricingTable table,
        IReadOnlyList<PricingTierSnapshot> tiers) =>
        new(
            table.Id,
            table.Category,
            table.Name,
            table.PricingKind,
            table.ManagedBy,
            table.IsActive,
            table.CourtVisitFeeSar,
            table.FieldInspectorIndividualFeeSar,
            table.FieldInspectorOrganizationFeeSar,
            table.FlatAmountSar,
            tiers);
}
