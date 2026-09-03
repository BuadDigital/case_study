using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Services;

public sealed partial class PartyFeePricingService
{
    private async Task EnsureAllCategoriesSeededAsync(CancellationToken cancellationToken)
    {
        await EnsureCategorySeededAsync(
            PartyFeePricingCategories.EngineeringSurvey,
            DefaultEngineeringTableId,
            "افتراضي",
            cancellationToken);
        await EnsureCategorySeededAsync(
            PartyFeePricingCategories.CourtVisit,
            DefaultCourtVisitTableId,
            "افتراضي",
            cancellationToken);
        await EnsureCategorySeededAsync(
            PartyFeePricingCategories.FieldInspector,
            DefaultInspectorTableId,
            "افتراضي",
            cancellationToken);
    }

    private async Task EnsureCategorySeededAsync(
        string category,
        Guid defaultId,
        string defaultName,
        CancellationToken cancellationToken)
    {
        var hasActive = await _db.AnyActiveTableInCategoryAsync(category, cancellationToken);
        if (hasActive) return;

        var any = await _db.FindFirstNonFlatTableByNameAsync(category, cancellationToken);
        if (any is not null)
        {
            var before = PartyFeePricingSnapshots.Snapshot(any);
            any.IsActive = true;
            any.UpdatedAtUtc = _time.UtcNow();
            AddAudit(
                "system",
                "PRICING_TABLE_ACTIVATED",
                nameof(PartyFeePricingTable),
                any.Id,
                before,
                PartyFeePricingSnapshots.Snapshot(any));
            await _db.SaveChangesAsync(cancellationToken);
            return;
        }

 // A placeholder so each category always has an active row for the pricing screen to edit.
 // It carries no amounts: an empty table must block fees, not quietly supply them. Migrating an
 // installation that predates the category split is the job of the migration that split it, not
 // of this placeholder — it used to copy amounts off whatever table was newest, across
 // categories.
        var table = new PartyFeePricingTable
        {
            Id = defaultId,
            Category = category,
            Name = defaultName,
            PricingKind = PartyFeePricingKinds.DefaultForCategory(category),
            ManagedBy = PartyFeePricingManagers.SystemAdmin,
            IsActive = true,
            UpdatedAtUtc = _time.UtcNow(),
        };

        _db.AddTable(table);
        AddAudit(
            "system",
            "PRICING_TABLE_CREATED",
            nameof(PartyFeePricingTable),
            table.Id,
            before: null,
            after: PartyFeePricingSnapshots.Snapshot(table));
        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// The category's active table. Callers run after seeding, which guarantees one exists;
    /// a missing row is a broken invariant, not an empty result.
    /// </summary>
    private async Task<PartyFeePricingTable> RequireActiveAsync(
        string category,
        CancellationToken cancellationToken) =>
        await _db.FindActiveTableAsync(category, cancellationToken)
        ?? throw new InvalidOperationException(
            $"No active party-fee pricing table for category '{category}'.");

    private async Task<PartyFeePricingDto> BuildMergedActiveDtoAsync(CancellationToken cancellationToken)
    {
        var engineering = await RequireActiveAsync(
            PartyFeePricingCategories.EngineeringSurvey, cancellationToken);
        var government = await RequireActiveAsync(
            PartyFeePricingCategories.CourtVisit, cancellationToken);
        var inspector = await RequireActiveAsync(
            PartyFeePricingCategories.FieldInspector, cancellationToken);

        var engDto = await ToDtoAsync(engineering, cancellationToken);
        return new PartyFeePricingDto
        {
            Id = engineering.Id,
            Category = PartyFeePricingCategories.EngineeringSurvey,
            Name = engineering.Name,
            PricingKind = engineering.PricingKind,
            ManagedBy = engineering.ManagedBy,
            IsActive = true,
            AreaTiers = engDto.AreaTiers,
            CourtVisitFeeSar = government.CourtVisitFeeSar,
            FieldInspectorIndividualFeeSar = inspector.FieldInspectorIndividualFeeSar,
            FieldInspectorOrganizationFeeSar = inspector.FieldInspectorOrganizationFeeSar,
            FlatAmountSar = 0m,
            UpdatedAtUtc = new[] { engineering.UpdatedAtUtc, government.UpdatedAtUtc, inspector.UpdatedAtUtc }.Max(),
        };
    }
}
