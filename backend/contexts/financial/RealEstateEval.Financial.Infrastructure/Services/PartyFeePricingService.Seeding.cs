using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

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
        var hasActive = await _db.PartyFeePricingTables.AsNoTracking()
            .AnyAsync(x => x.Category == category && x.IsActive, cancellationToken);
        if (hasActive) return;

        var any = await _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .Where(x => x.Category == category && x.PricingKind != PartyFeePricingKinds.Flat)
            .OrderBy(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);
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

        _db.PartyFeePricingTables.Add(table);
        AddAudit(
            "system",
            "PRICING_TABLE_CREATED",
            nameof(PartyFeePricingTable),
            table.Id,
            before: null,
            after: PartyFeePricingSnapshots.Snapshot(table));
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<PartyFeePricingDto> BuildMergedActiveDtoAsync(CancellationToken cancellationToken)
    {
        var engineering = await _db.PartyFeePricingTables.AsNoTracking()
            .Include(x => x.AreaTiers)
            .FirstAsync(x => x.Category == PartyFeePricingCategories.EngineeringSurvey && x.IsActive, cancellationToken);
        var government = await _db.PartyFeePricingTables.AsNoTracking()
            .FirstAsync(x => x.Category == PartyFeePricingCategories.CourtVisit && x.IsActive, cancellationToken);
        var inspector = await _db.PartyFeePricingTables.AsNoTracking()
            .FirstAsync(x => x.Category == PartyFeePricingCategories.FieldInspector && x.IsActive, cancellationToken);

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
