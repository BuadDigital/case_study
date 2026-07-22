using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PartyFeePricingService : IPartyFeePricingService
{
    public static readonly Guid DefaultEngineeringTableId =
        Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    public static readonly Guid DefaultGovernmentTableId =
        Guid.Parse("b2c3d4e5-f6a7-8901-bcde-f12345678901");

    public static readonly Guid DefaultInspectorTableId =
        Guid.Parse("c3d4e5f6-a7b8-9012-cdef-123456789012");

    private readonly ApplicationDbContext _db;

    public PartyFeePricingService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<PartyFeePricingTableSummaryDto>> ListAsync(
        string? category = null,
        CancellationToken cancellationToken = default)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var normalizedCategory = string.IsNullOrWhiteSpace(category)
            ? null
            : PartyFeePricingCategories.Normalize(category);

        var query = _db.PartyFeePricingTables.AsNoTracking();
        if (normalizedCategory is not null)
            query = query.Where(x => x.Category == normalizedCategory);

        var tables = await query
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.Name)
            .Select(x => new PartyFeePricingTableSummaryDto
            {
                Id = x.Id,
                Category = x.Category,
                Name = x.Name,
                IsActive = x.IsActive,
                UpdatedAtUtc = x.UpdatedAtUtc,
            })
            .ToListAsync(cancellationToken);

        if (tables.Count == 0) return tables;

        var tableIds = tables.Select(t => t.Id).ToList();
        var counts = await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => tableIds.Contains(a.TableId))
            .GroupBy(a => a.TableId)
            .Select(g => new { TableId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var countByTable = counts.ToDictionary(x => x.TableId, x => x.Count);

        foreach (var table in tables)
            table.AssignedCount = countByTable.GetValueOrDefault(table.Id);

        return tables;
    }

    public async Task<PartyFeePricingDto> GetActiveAsync(CancellationToken cancellationToken = default)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        return await BuildMergedActiveDtoAsync(cancellationToken);
    }

    public async Task<PartyFeePricingDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var table = await LoadTableAsync(id, tracking: false, cancellationToken);
        return table is null ? null : await ToDtoAsync(table, cancellationToken);
    }

    public async Task<PartyFeePricingDto> CreateAsync(
        CreatePartyFeePricingTableRequest request,
        CancellationToken cancellationToken = default)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var category = PartyFeePricingCategories.Normalize(request.Category);
        var name = NormalizeName(request.Name, category);

        PartyFeePricingTable? source = null;
        if (request.CopyFromTableId is Guid copyId)
            source = await LoadTableAsync(copyId, tracking: false, cancellationToken);

        source ??= await _db.PartyFeePricingTables.AsNoTracking()
            .Include(x => x.AreaTiers)
            .Where(x => x.Category == category)
            .OrderByDescending(x => x.IsActive)
            .ThenByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var hasAnyInCategory = await _db.PartyFeePricingTables
            .AnyAsync(x => x.Category == category, cancellationToken);

        var table = new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = category,
            Name = name,
            IsActive = !hasAnyInCategory,
            GovernmentReviewFeeSar = source?.GovernmentReviewFeeSar
                ?? GovernmentReviewFeeRules.FallbackFeeSar,
            KeyReceiptFeeSar = source is null
                ? GovernmentReviewFeeRules.FallbackFeeSar
                : (source.KeyReceiptFeeSar > 0 ? source.KeyReceiptFeeSar : source.GovernmentReviewFeeSar),
            FieldInspectorIndividualFeeSar = source?.FieldInspectorIndividualFeeSar
                ?? InspectorFeeRules.CooperatorIndividualFeeSar,
            FieldInspectorOrganizationFeeSar = source?.FieldInspectorOrganizationFeeSar
                ?? InspectorFeeRules.CooperatorOrganizationFeeSar,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        if (category == PartyFeePricingCategories.EngineeringSurvey)
        {
            var sourceTiers = source?.AreaTiers
                .OrderBy(t => t.SortOrder)
                .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
                .ToList();
            ApplyTiersInMemory(table, sourceTiers is { Count: > 0 }
                ? sourceTiers
                : EngineeringSurveyFeeRules.SeedTiers());
        }

        _db.PartyFeePricingTables.Add(table);
        await _db.SaveChangesAsync(cancellationToken);
        return await ToDtoAsync(table, cancellationToken);
    }

    public async Task<PartyFeePricingDto> SaveAsync(
        Guid id,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default)
    {
        var table = await _db.PartyFeePricingTables
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {id} was not found.");

        table.Name = NormalizeName(request.Name, table.Category);
        table.UpdatedAtUtc = DateTime.UtcNow;

        switch (table.Category)
        {
            case PartyFeePricingCategories.EngineeringSurvey:
            {
                var incoming = (request.AreaTiers ?? [])
                    .OrderBy(t => t.SortOrder)
                    .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
                    .ToList();
                await ReplaceTiersAsync(
                    table,
                    EngineeringSurveyFeeRules.NormalizeTiers(incoming),
                    cancellationToken);
                break;
            }
            case PartyFeePricingCategories.GovernmentReview:
                table.GovernmentReviewFeeSar = Math.Max(0m, request.GovernmentReviewFeeSar);
                table.KeyReceiptFeeSar = Math.Max(0m, request.KeyReceiptFeeSar);
                break;
            case PartyFeePricingCategories.FieldInspector:
                table.FieldInspectorIndividualFeeSar = Math.Max(0m, request.FieldInspectorIndividualFeeSar);
                table.FieldInspectorOrganizationFeeSar = Math.Max(0m, request.FieldInspectorOrganizationFeeSar);
                break;
        }

        await _db.SaveChangesAsync(cancellationToken);
        var reloaded = await LoadTableAsync(id, tracking: false, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {id} was not found after save.");
        return await ToDtoAsync(reloaded, cancellationToken);
    }

    public async Task<PartyFeePricingDto> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var table = await LoadTableAsync(id, tracking: true, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {id} was not found.");

        var others = await _db.PartyFeePricingTables
            .Where(x => x.Id != id && x.Category == table.Category && x.IsActive)
            .ToListAsync(cancellationToken);
        foreach (var other in others)
            other.IsActive = false;

        table.IsActive = true;
        table.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return await ToDtoAsync(table, cancellationToken);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var table = await LoadTableAsync(id, tracking: true, cancellationToken);
        if (table is null) return false;

        var countInCategory = await _db.PartyFeePricingTables
            .CountAsync(x => x.Category == table.Category, cancellationToken);
        if (countInCategory <= 1)
            throw new InvalidOperationException("Cannot delete the last pricing table in this category.");

        var wasActive = table.IsActive;
        var category = table.Category;
        _db.PartyFeePricingTables.Remove(table);
        await _db.SaveChangesAsync(cancellationToken);

        if (wasActive)
        {
            var next = await _db.PartyFeePricingTables
                .Where(x => x.Category == category)
                .OrderBy(x => x.Name)
                .FirstAsync(cancellationToken);
            next.IsActive = true;
            next.UpdatedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return true;
    }

    public async Task<IReadOnlyList<string>> ListAssignmentsAsync(
        Guid tableId,
        CancellationToken cancellationToken = default)
    {
        return await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => a.TableId == tableId)
            .OrderBy(a => a.AssigneeId)
            .Select(a => a.AssigneeId)
            .ToListAsync(cancellationToken);
    }

    public async Task<PartyFeePricingDto> SetAssignmentsAsync(
        Guid tableId,
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken = default)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var table = await LoadTableAsync(tableId, tracking: true, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {tableId} was not found.");

        var normalized = assigneeIds
            .Select(id => (id ?? "").Trim())
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var now = DateTime.UtcNow;

        if (normalized.Count > 0)
        {
            var conflicting = await _db.PartyFeePricingAssignments
                .Where(a =>
                    a.Category == table.Category
                    && a.TableId != tableId
                    && normalized.Contains(a.AssigneeId))
                .ToListAsync(cancellationToken);
            if (conflicting.Count > 0)
                _db.PartyFeePricingAssignments.RemoveRange(conflicting);
        }

        var existing = await _db.PartyFeePricingAssignments
            .Where(a => a.TableId == tableId)
            .ToListAsync(cancellationToken);
        _db.PartyFeePricingAssignments.RemoveRange(existing);

        foreach (var assigneeId in normalized)
        {
            _db.PartyFeePricingAssignments.Add(new PartyFeePricingAssignment
            {
                Id = Guid.NewGuid(),
                TableId = tableId,
                Category = table.Category,
                AssigneeId = assigneeId,
                UpdatedAtUtc = now,
            });
        }

        table.UpdatedAtUtc = now;
        await _db.SaveChangesAsync(cancellationToken);

        var reloaded = await LoadTableAsync(tableId, tracking: false, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {tableId} was not found after assign.");
        return await ToDtoAsync(reloaded, cancellationToken);
    }

    public async Task<decimal?> ResolveDefaultFeeAsync(
        string taskKind,
        string partyType,
        decimal? areaM2 = null,
        string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var category = CategoryForTaskKind(taskKind);
        if (category is null) return null;

        var pricing = await ResolveTableDtoForAssigneeAsync(
            category,
            assigneeId,
            cancellationToken);
        if (pricing is null) return null;

        return ResolveFromDto(pricing, taskKind, partyType, areaM2);
    }

    public static decimal? ResolveFromDto(
        PartyFeePricingDto pricing,
        string taskKind,
        string partyType,
        decimal? areaM2 = null)
    {
        if (string.Equals(taskKind, "engineering-survey", StringComparison.OrdinalIgnoreCase))
        {
            if (areaM2 is not > 0m) return null;
            var tiers = (pricing.AreaTiers ?? [])
                .OrderBy(t => t.SortOrder)
                .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
                .ToList();
            return EngineeringSurveyFeeRules.ResolveFeeFromTiers(areaM2.Value, tiers);
        }

        if (string.Equals(taskKind, "government-review", StringComparison.OrdinalIgnoreCase))
            return pricing.GovernmentReviewFeeSar;

        if (InspectorFeeRules.IsEmployee(partyType))
            return null;

        return partyType switch
        {
            InspectorFeeRules.TypeCooperatorOrganization => pricing.FieldInspectorOrganizationFeeSar,
            InspectorFeeRules.TypeCooperatorIndividual
                or InspectorFeeRules.TypeCooperatorLegacy => pricing.FieldInspectorIndividualFeeSar,
            _ => null,
        };
    }

    private static string? CategoryForTaskKind(string taskKind)
    {
        if (string.Equals(taskKind, "engineering-survey", StringComparison.OrdinalIgnoreCase))
            return PartyFeePricingCategories.EngineeringSurvey;
        if (string.Equals(taskKind, "government-review", StringComparison.OrdinalIgnoreCase))
            return PartyFeePricingCategories.GovernmentReview;
        if (string.Equals(taskKind, "field-inspection", StringComparison.OrdinalIgnoreCase))
            return PartyFeePricingCategories.FieldInspector;
        return null;
    }

    private async Task<PartyFeePricingDto?> ResolveTableDtoForAssigneeAsync(
        string category,
        string? assigneeId,
        CancellationToken cancellationToken)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var trimmed = assigneeId?.Trim();

        if (!string.IsNullOrEmpty(trimmed))
        {
            var assignedTableId = await _db.PartyFeePricingAssignments.AsNoTracking()
                .Where(a => a.Category == category && a.AssigneeId == trimmed)
                .Select(a => (Guid?)a.TableId)
                .FirstOrDefaultAsync(cancellationToken);

            if (assignedTableId is Guid tableId)
            {
                var assigned = await LoadTableAsync(tableId, tracking: false, cancellationToken);
                if (assigned is not null)
                    return await ToDtoAsync(assigned, cancellationToken);
            }

            // Engineering office: no table until explicitly assigned (no silent default).
            if (category == PartyFeePricingCategories.EngineeringSurvey)
                return null;
        }

        var fallback = await _db.PartyFeePricingTables.AsNoTracking()
            .Include(x => x.AreaTiers)
            .FirstOrDefaultAsync(x => x.Category == category && x.IsActive, cancellationToken);
        return fallback is null ? null : await ToDtoAsync(fallback, cancellationToken);
    }

    private async Task EnsureAllCategoriesSeededAsync(CancellationToken cancellationToken)
    {
        await EnsureCategorySeededAsync(
            PartyFeePricingCategories.EngineeringSurvey,
            DefaultEngineeringTableId,
            "افتراضي",
            cancellationToken);
        await EnsureCategorySeededAsync(
            PartyFeePricingCategories.GovernmentReview,
            DefaultGovernmentTableId,
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
        var active = await _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .FirstOrDefaultAsync(x => x.Category == category && x.IsActive, cancellationToken);
        if (active is not null) return;

        var any = await _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .Where(x => x.Category == category)
            .OrderBy(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);
        if (any is not null)
        {
            any.IsActive = true;
            any.UpdatedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
            return;
        }

        var legacy = await _db.PartyFeePricingTables.AsNoTracking()
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var table = new PartyFeePricingTable
        {
            Id = defaultId,
            Category = category,
            Name = defaultName,
            IsActive = true,
            GovernmentReviewFeeSar = legacy?.GovernmentReviewFeeSar
                ?? GovernmentReviewFeeRules.FallbackFeeSar,
            KeyReceiptFeeSar = legacy is null
                ? GovernmentReviewFeeRules.FallbackFeeSar
                : (legacy.KeyReceiptFeeSar > 0 ? legacy.KeyReceiptFeeSar : legacy.GovernmentReviewFeeSar),
            FieldInspectorIndividualFeeSar = legacy?.FieldInspectorIndividualFeeSar
                ?? InspectorFeeRules.CooperatorIndividualFeeSar,
            FieldInspectorOrganizationFeeSar = legacy?.FieldInspectorOrganizationFeeSar
                ?? InspectorFeeRules.CooperatorOrganizationFeeSar,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        if (category == PartyFeePricingCategories.EngineeringSurvey)
            ApplyTiersInMemory(table, EngineeringSurveyFeeRules.SeedTiers());

        _db.PartyFeePricingTables.Add(table);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<PartyFeePricingDto> BuildMergedActiveDtoAsync(CancellationToken cancellationToken)
    {
        var engineering = await _db.PartyFeePricingTables.AsNoTracking()
            .Include(x => x.AreaTiers)
            .FirstAsync(x => x.Category == PartyFeePricingCategories.EngineeringSurvey && x.IsActive, cancellationToken);
        var government = await _db.PartyFeePricingTables.AsNoTracking()
            .FirstAsync(x => x.Category == PartyFeePricingCategories.GovernmentReview && x.IsActive, cancellationToken);
        var inspector = await _db.PartyFeePricingTables.AsNoTracking()
            .FirstAsync(x => x.Category == PartyFeePricingCategories.FieldInspector && x.IsActive, cancellationToken);

        var engDto = await ToDtoAsync(engineering, cancellationToken);
        return new PartyFeePricingDto
        {
            Id = engineering.Id,
            Category = PartyFeePricingCategories.EngineeringSurvey,
            Name = engineering.Name,
            IsActive = true,
            AreaTiers = engDto.AreaTiers,
            GovernmentReviewFeeSar = government.GovernmentReviewFeeSar,
            KeyReceiptFeeSar = government.KeyReceiptFeeSar > 0
                ? government.KeyReceiptFeeSar
                : government.GovernmentReviewFeeSar,
            FieldInspectorIndividualFeeSar = inspector.FieldInspectorIndividualFeeSar,
            FieldInspectorOrganizationFeeSar = inspector.FieldInspectorOrganizationFeeSar,
            UpdatedAtUtc = new[] { engineering.UpdatedAtUtc, government.UpdatedAtUtc, inspector.UpdatedAtUtc }.Max(),
        };
    }

    private async Task<PartyFeePricingTable?> LoadTableAsync(
        Guid id,
        bool tracking,
        CancellationToken cancellationToken)
    {
        IQueryable<PartyFeePricingTable> q = _db.PartyFeePricingTables.Include(x => x.AreaTiers);
        if (!tracking) q = q.AsNoTracking();
        return await q.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    private async Task ReplaceTiersAsync(
        PartyFeePricingTable table,
        IReadOnlyList<EngineeringSurveyFeeRules.AreaFeeTier> tiers,
        CancellationToken cancellationToken)
    {
        var normalized = EngineeringSurveyFeeRules.NormalizeTiers(tiers);

        await _db.PartyFeePricingTiers
            .Where(t => t.TableId == table.Id)
            .ExecuteDeleteAsync(cancellationToken);

        var newRows = normalized
            .Select((t, i) => new PartyFeePricingTier
            {
                Id = Guid.NewGuid(),
                TableId = table.Id,
                SortOrder = i,
                MaxAreaM2 = t.MaxAreaM2,
                FeeSar = t.FeeSar,
            })
            .ToList();
        _db.PartyFeePricingTiers.AddRange(newRows);
    }

    private static void ApplyTiersInMemory(
        PartyFeePricingTable table,
        IReadOnlyList<EngineeringSurveyFeeRules.AreaFeeTier> tiers)
    {
        var normalized = EngineeringSurveyFeeRules.NormalizeTiers(tiers);
        for (var i = 0; i < normalized.Count; i++)
        {
            table.AreaTiers.Add(new PartyFeePricingTier
            {
                Id = Guid.NewGuid(),
                TableId = table.Id,
                SortOrder = i,
                MaxAreaM2 = normalized[i].MaxAreaM2,
                FeeSar = normalized[i].FeeSar,
            });
        }
    }

    private static string NormalizeName(string? name, string category)
    {
        var trimmed = (name ?? "").Trim();
        if (!string.IsNullOrEmpty(trimmed))
            return trimmed[..Math.Min(trimmed.Length, 128)];

        return "افتراضي";
    }

    private async Task<PartyFeePricingDto> ToDtoAsync(
        PartyFeePricingTable table,
        CancellationToken cancellationToken)
    {
        var assigneeIds = await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => a.TableId == table.Id)
            .OrderBy(a => a.AssigneeId)
            .Select(a => a.AssigneeId)
            .ToListAsync(cancellationToken);

        var tiers = table.AreaTiers
            .OrderBy(t => t.SortOrder)
            .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
            .ToList();
        var normalized = EngineeringSurveyFeeRules.NormalizeTiers(tiers);

        return new PartyFeePricingDto
        {
            Id = table.Id,
            Category = table.Category,
            Name = table.Name,
            IsActive = table.IsActive,
            AssignedCount = assigneeIds.Count,
            AssignedAssigneeIds = assigneeIds,
            AreaTiers = normalized
                .Select((t, i) => new PartyFeePricingTierDto
                {
                    SortOrder = i,
                    MaxAreaM2 = t.MaxAreaM2,
                    FeeSar = t.FeeSar,
                })
                .ToList(),
            GovernmentReviewFeeSar = table.GovernmentReviewFeeSar,
            KeyReceiptFeeSar = table.KeyReceiptFeeSar > 0
                ? table.KeyReceiptFeeSar
                : table.GovernmentReviewFeeSar,
            FieldInspectorIndividualFeeSar = table.FieldInspectorIndividualFeeSar,
            FieldInspectorOrganizationFeeSar = table.FieldInspectorOrganizationFeeSar,
            UpdatedAtUtc = table.UpdatedAtUtc,
        };
    }
}
