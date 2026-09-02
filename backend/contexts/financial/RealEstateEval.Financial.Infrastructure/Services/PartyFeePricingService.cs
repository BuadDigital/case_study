using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed partial class PartyFeePricingService : IPartyFeePricingService
{
    private const int MaxPricingTables = 100;
    public static readonly Guid DefaultEngineeringTableId =
        Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    public static readonly Guid DefaultCourtVisitTableId =
        Guid.Parse("b2c3d4e5-f6a7-8901-bcde-f12345678901");

    public static readonly Guid DefaultInspectorTableId =
        Guid.Parse("c3d4e5f6-a7b8-9012-cdef-123456789012");

    private readonly FinancialDbContext _db;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    public PartyFeePricingService(FinancialDbContext db,
        TimeProvider? time = null)
        : this(db, new AuditLogWriter(time), time)
    {
    }

    public PartyFeePricingService(FinancialDbContext db, IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _audit = audit;
    }

    public async Task<IReadOnlyList<PartyFeePricingTableSummaryDto>> ListAsync(
        string? category = null,
        CancellationToken cancellationToken = default)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var normalizedCategory = string.IsNullOrWhiteSpace(category)
            ? null
            : PartyFeePricingCategories.Require(category);

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
                PricingKind = x.PricingKind,
                ManagedBy = x.ManagedBy,
                IsActive = x.IsActive,
                UpdatedAtUtc = x.UpdatedAtUtc,
            })
            .Take(MaxPricingTables)
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
        CancellationToken cancellationToken = default,
        string actorId = "system")
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var shape = PartyFeePricingRules.ResolveNewTableShape(request);
        var category = shape.Category;
        var pricingKind = shape.PricingKind;

        PartyFeePricingTable? source = null;
        if (pricingKind != PartyFeePricingKinds.Flat)
        {
            if (request.CopyFromTableId is Guid copyId)
            {
                source = await LoadTableAsync(copyId, tracking: false, cancellationToken)
                    ?? throw new InvalidOperationException(
                        "جدول المصدر المطلوب النسخ منه غير موجود.");
                PartyFeePricingRules.ValidateCopySource(source, category);
            }
            else
            {
 // No source asked for: start from the current rates of the same category.
                source = await _db.PartyFeePricingTables.AsNoTracking()
                    .Include(x => x.AreaTiers)
                    .Where(x => x.Category == category
                        && x.PricingKind != PartyFeePricingKinds.Flat)
                    .OrderByDescending(x => x.IsActive)
                    .ThenByDescending(x => x.UpdatedAtUtc)
                    .FirstOrDefaultAsync(cancellationToken);
            }
        }

        var hasAnyInCategory = await _db.PartyFeePricingTables
            .AnyAsync(x => x.Category == category, cancellationToken);

        var table = PartyFeePricingRules.BuildNewTable(
            shape,
            source,
            request.FlatAmountSar,
            PartyFeePricingRules.IsCategoryDefaultOnCreate(pricingKind, hasAnyInCategory),
            _time.UtcNow());

        _db.PartyFeePricingTables.Add(table);
        AddAudit(
            actorId,
            "PRICING_TABLE_CREATED",
            nameof(PartyFeePricingTable),
            table.Id,
            before: null,
            after: PartyFeePricingSnapshots.Snapshot(table));
        await _db.SaveChangesAsync(cancellationToken);
        return await ToDtoAsync(table, cancellationToken);
    }

    public async Task<PartyFeePricingDto> SaveAsync(
        Guid id,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default,
        string actorId = "system")
    {
        var table = await LoadTableAsync(id, tracking: true, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {id} was not found.");
        if (await _db.PartyFeePricingAssignments
            .AnyAsync(a => a.TableId == id, cancellationToken))
        {
            throw new InvalidOperationException(
                "لا يمكن تعديل جدول مرتبط بأطراف — احفظ التغيير كنسخة جديدة لإعادة ربطهم ذرّياً.");
        }
        var before = PartyFeePricingSnapshots.Snapshot(table);

        table.Name = PartyFeePricingRules.NormalizeName(request.Name, table.Category);
        table.UpdatedAtUtc = _time.UtcNow();
        await ApplyRatesFromRequestAsync(table, request, cancellationToken);

        AddAudit(
            actorId,
            "PRICING_TABLE_UPDATED",
            nameof(PartyFeePricingTable),
            table.Id,
            before,
            SnapshotFromTrackedState(table));
        await _db.SaveChangesAsync(cancellationToken);
        var reloaded = await LoadTableAsync(id, tracking: false, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {id} was not found after save.");
        return await ToDtoAsync(reloaded, cancellationToken);
    }

    public async Task<PartyFeePricingDto> ReviseAsync(
        Guid sourceId,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default,
        string actorId = "system")
    {
        var source = await LoadTableAsync(sourceId, tracking: true, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {sourceId} was not found.");
        var assignments = await _db.PartyFeePricingAssignments
            .Where(a => a.TableId == sourceId)
            .OrderBy(a => a.AssigneeId)
            .ToListAsync(cancellationToken);
        if (assignments.Count == 0)
        {
            throw new InvalidOperationException(
                "الجدول غير مرتبط بأطراف ويمكن تعديله مباشرة دون إنشاء نسخة.");
        }

        var now = _time.UtcNow();
        var sourceBefore = PartyFeePricingSnapshots.Snapshot(source);
        var wasSourceActive = source.IsActive;
        var revision = PartyFeePricingRules.BuildRevision(source, request, now);

        if (wasSourceActive)
        {
            source.IsActive = false;
            source.UpdatedAtUtc = now;
            AddAudit(
                actorId,
                "PRICING_TABLE_DEACTIVATED",
                nameof(PartyFeePricingTable),
                source.Id,
                sourceBefore,
                PartyFeePricingSnapshots.Snapshot(source));
        }

        var categoryBefore = await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => a.Category == source.Category)
            .OrderBy(a => a.TableId)
            .ThenBy(a => a.AssigneeId)
            .Select(a => new PricingAssignmentSnapshot(a.TableId, a.AssigneeId))
            .ToListAsync(cancellationToken);
        foreach (var assignment in assignments)
        {
            assignment.TableId = revision.Id;
            assignment.UpdatedAtUtc = now;
        }

        _db.PartyFeePricingTables.Add(revision);
        var categoryAfter = PartyFeePricingRules.RelinkedAssignments(
            categoryBefore,
            sourceId,
            revision.Id);
        AddAudit(
            actorId,
            "PRICING_TABLE_REVISED",
            nameof(PartyFeePricingTable),
            revision.Id,
            sourceBefore,
            PartyFeePricingSnapshots.Snapshot(revision));
        AddAudit(
            actorId,
            "PRICING_ASSIGNMENTS_RELINKED",
            nameof(PartyFeePricingAssignment),
            revision.Id,
            categoryBefore,
            categoryAfter);

        await _db.SaveChangesAsync(cancellationToken);

        if (wasSourceActive)
        {
            var revisionBeforeActivate = PartyFeePricingSnapshots.Snapshot(revision);
            revision.IsActive = true;
            revision.UpdatedAtUtc = _time.UtcNow();
            AddAudit(
                actorId,
                "PRICING_TABLE_ACTIVATED",
                nameof(PartyFeePricingTable),
                revision.Id,
                revisionBeforeActivate,
                PartyFeePricingSnapshots.Snapshot(revision));
            await _db.SaveChangesAsync(cancellationToken);
        }

        var reloaded = await LoadTableAsync(revision.Id, tracking: false, cancellationToken)
            ?? throw new KeyNotFoundException(
                $"Pricing table revision {revision.Id} was not found after save.");
        return await ToDtoAsync(reloaded, cancellationToken);
    }

    public async Task<PartyFeePricingDto> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default,
        string actorId = "system")
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var table = await LoadTableAsync(id, tracking: true, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {id} was not found.");

        PartyFeePricingRules.ValidateActivatable(table);

        var others = await _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .Where(x => x.Id != id && x.Category == table.Category && x.IsActive)
            .ToListAsync(cancellationToken);

 // Postgres filtered unique index IX_PartyFeePricingTables_Category_OneActive is checked
 // per statement. Deactivate others in one SaveChanges, then activate in a second pass,
 // inside one transaction so a failed activation rolls back the demotions too.
        var now = _time.UtcNow();
        await DbContextTransaction.ExecuteInTransactionAsync(_db, async ct =>
        {
            foreach (var other in others)
            {
                var before = PartyFeePricingSnapshots.Snapshot(other);
                other.IsActive = false;
                other.UpdatedAtUtc = now;
                AddAudit(
                    actorId,
                    "PRICING_TABLE_DEACTIVATED",
                    nameof(PartyFeePricingTable),
                    other.Id,
                    before,
                    PartyFeePricingSnapshots.Snapshot(other));
            }

            if (others.Count > 0)
                await _db.SaveChangesAsync(ct);

            if (!table.IsActive)
            {
                var targetBefore = PartyFeePricingSnapshots.Snapshot(table);
                table.IsActive = true;
                table.UpdatedAtUtc = now;
                AddAudit(
                    actorId,
                    "PRICING_TABLE_ACTIVATED",
                    nameof(PartyFeePricingTable),
                    table.Id,
                    targetBefore,
                    PartyFeePricingSnapshots.Snapshot(table));
                await _db.SaveChangesAsync(ct);
            }
        }, cancellationToken);

        return await ToDtoAsync(table, cancellationToken);
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken = default,
        string actorId = "system")
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var table = await LoadTableAsync(id, tracking: true, cancellationToken);
        if (table is null) return false;

        var countInCategory = await _db.PartyFeePricingTables
            .CountAsync(x => x.Category == table.Category, cancellationToken);
        if (countInCategory <= 1)
            throw new InvalidOperationException("Cannot delete the last pricing table in this category.");
        if (await _db.PartyFeePricingAssignments
            .AnyAsync(a => a.TableId == id, cancellationToken))
        {
            throw new InvalidOperationException(
                "لا يمكن حذف جدول مرتبط بأطراف — انقل الإسنادات أولاً.");
        }

        var wasActive = table.IsActive;
        var category = table.Category;
        var deletedSnapshot = PartyFeePricingSnapshots.Snapshot(table);
        _db.PartyFeePricingTables.Remove(table);

 // Promote the next table in the same SaveChanges so a failure cannot leave the
 // category without an active pricing table.
        if (wasActive)
        {
            var next = await _db.PartyFeePricingTables
                .Include(x => x.AreaTiers)
                .Where(x => x.Id != id && x.Category == category)
                .OrderBy(x => x.Name)
                .FirstAsync(cancellationToken);
            var nextBefore = PartyFeePricingSnapshots.Snapshot(next);
            next.IsActive = true;
            next.UpdatedAtUtc = _time.UtcNow();
            AddAudit(
                actorId,
                "PRICING_TABLE_ACTIVATED",
                nameof(PartyFeePricingTable),
                next.Id,
                nextBefore,
                PartyFeePricingSnapshots.Snapshot(next));
        }

        AddAudit(
            actorId,
            "PRICING_TABLE_DELETED",
            nameof(PartyFeePricingTable),
            table.Id,
            deletedSnapshot,
            after: null);
        await _db.SaveChangesAsync(cancellationToken);
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
        CancellationToken cancellationToken = default,
        string actorId = "system")
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var table = await LoadTableAsync(tableId, tracking: true, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {tableId} was not found.");

        var normalized = PartyFeePricingRules.NormalizeAssigneeIds(assigneeIds);
        var categoryBefore = await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => a.Category == table.Category)
            .OrderBy(a => a.TableId)
            .ThenBy(a => a.AssigneeId)
            .Select(a => new PricingAssignmentSnapshot(a.TableId, a.AssigneeId))
            .ToListAsync(cancellationToken);

        var now = _time.UtcNow();

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
        var categoryAfter = PartyFeePricingRules.AssignmentsAfterReplace(
            categoryBefore,
            tableId,
            normalized);
        AddAudit(
            actorId,
            "PRICING_ASSIGNMENTS_REPLACED",
            nameof(PartyFeePricingAssignment),
            table.Id,
            categoryBefore,
            categoryAfter);
        await _db.SaveChangesAsync(cancellationToken);

        var reloaded = await LoadTableAsync(tableId, tracking: false, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {tableId} was not found after assign.");
        return await ToDtoAsync(reloaded, cancellationToken);
    }

    public async Task<ResolvedPartyFee> ResolveDefaultFeeAsync(
        WorkflowTaskKind taskKind,
        string partyType,
        decimal? areaM2 = null,
        string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var category = PartyFeePricingRules.CategoryForTaskKind(taskKind);
        if (category is null) return ResolvedPartyFee.Unresolved;

 // Employee incentives may only come from flat tables. An accidental party-rates assignment
 // (or the cooperator category default) must not silently leave the employee unpriced —
 // and must not price them from cooperator columns.
        var pricing = PartyFeePricingRules.UsesEmployeeIncentiveTable(partyType, taskKind)
            ? await ResolveEmployeeIncentiveTableAsync(category, assigneeId, cancellationToken)
            : await ResolveTableDtoForAssigneeAsync(category, assigneeId, cancellationToken);

        if (pricing is null) return ResolvedPartyFee.Unresolved;

        return PartyFeePricingRules.ResolvedOrUnresolved(
            PartyFeePricingRules.ResolveFromDto(pricing, taskKind, partyType, areaM2),
            pricing.Id);
    }

 /// <summary>
 /// Flat table assigned to the employee, else any flat incentive table for the category.
 /// Never returns the cooperator party-rates default.
 /// </summary>
    private async Task<PartyFeePricingDto?> ResolveEmployeeIncentiveTableAsync(
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
                if (PartyFeePricingRules.IsUsableEmployeeIncentiveTable(assigned))
                    return await ToDtoAsync(assigned!, cancellationToken);
            }
        }

        var flat = await _db.PartyFeePricingTables.AsNoTracking()
            .Where(x =>
                x.Category == category
                && x.PricingKind == PartyFeePricingKinds.Flat
                && x.FlatAmountSar > 0m)
            .OrderBy(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);

        return flat is null ? null : await ToDtoAsync(flat, cancellationToken);
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

            if (!PartyFeePricingRules.AllowsCategoryDefaultFallback(category))
                return null;
        }

        var fallback = await _db.PartyFeePricingTables.AsNoTracking()
            .Include(x => x.AreaTiers)
            .FirstOrDefaultAsync(x => x.Category == category && x.IsActive, cancellationToken);
        return fallback is null ? null : await ToDtoAsync(fallback, cancellationToken);
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
 // Removed through the change tracker rather than ExecuteDelete so the old tiers and the new
 // ones land in one SaveChanges — a failure between the two would otherwise leave the table
 // with no schedule at all.
        var old = await _db.PartyFeePricingTiers
            .Where(t => t.TableId == table.Id)
            .ToListAsync(cancellationToken);
        _db.PartyFeePricingTiers.RemoveRange(old);
        _db.PartyFeePricingTiers.AddRange(PartyFeePricingRules.BuildTierRows(table.Id, tiers));
    }

    private PricingTableSnapshot SnapshotFromTrackedState(PartyFeePricingTable table)
    {
        var tiers = _db.ChangeTracker.Entries<PartyFeePricingTier>()
            .Where(e => e.Entity.TableId == table.Id && e.State != EntityState.Deleted)
            .Select(e => e.Entity)
            .OrderBy(t => t.SortOrder)
            .Select(t => new PricingTierSnapshot(t.SortOrder, t.MaxAreaM2, t.FeeSar))
            .ToList();
        return PartyFeePricingSnapshots.Snapshot(table, tiers);
    }

    private async Task ApplyRatesFromRequestAsync(
        PartyFeePricingTable table,
        PartyFeePricingDto request,
        CancellationToken cancellationToken)
    {
        if (table.PricingKind == PartyFeePricingKinds.Flat)
        {
            PartyFeePricingRules.ApplyFlatRate(table, request.FlatAmountSar);
            await ReplaceTiersAsync(table, [], cancellationToken);
            return;
        }

        PartyFeePricingRules.ApplyCategoryRates(table, request);
        if (PartyFeePricingRules.UsesAreaTiers(table))
        {
            await ReplaceTiersAsync(
                table,
                PartyFeePricingRules.NormalizeRequestedTiers(request),
                cancellationToken);
        }
    }

    private void AddAudit(
        string actorId,
        string action,
        string entityType,
        Guid entityId,
        object? before,
        object? after)
    {
        _db.Set<AuditLog>().Add(_audit.Create(
            PartyFeePricingRules.NormalizeActor(actorId),
            action,
            entityType,
            entityId.ToString(),
            before,
            after));
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

        return PartyFeePricingRules.ToDto(table, assigneeIds);
    }
}
