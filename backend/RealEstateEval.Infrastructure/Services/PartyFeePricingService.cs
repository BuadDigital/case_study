using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PartyFeePricingService : IPartyFeePricingService
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

    public PartyFeePricingService(FinancialDbContext db)
        : this(db, new AuditLogWriter())
    {
    }

    public PartyFeePricingService(FinancialDbContext db, IAuditLogWriter audit)
    {
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
        var category = PartyFeePricingCategories.Require(request.Category);
        var name = NormalizeName(request.Name, category);
        var pricingKind = string.IsNullOrWhiteSpace(request.PricingKind)
            ? PartyFeePricingKinds.DefaultForCategory(category)
            : PartyFeePricingKinds.Require(request.PricingKind.Trim());
        var managedBy = string.IsNullOrWhiteSpace(request.ManagedBy)
            ? (pricingKind == PartyFeePricingKinds.Flat
                ? PartyFeePricingManagers.Supervisor
                : PartyFeePricingManagers.SystemAdmin)
            : PartyFeePricingManagers.Require(request.ManagedBy.Trim());
        ValidateKindManagerPair(pricingKind, managedBy, category);

        PartyFeePricingTable? source = null;
        if (pricingKind != PartyFeePricingKinds.Flat)
        {
            if (request.CopyFromTableId is Guid copyId)
            {
 // An explicit copy request that cannot be honoured must fail. Falling through to another
 // table would hand the new table rates the caller never asked for.
                source = await LoadTableAsync(copyId, tracking: false, cancellationToken)
                    ?? throw new InvalidOperationException(
                        "جدول المصدر المطلوب النسخ منه غير موجود.");

                if (source.Category != category)
                {
                    throw new InvalidOperationException(
                        "لا يمكن النسخ من تصنيف تسعير مختلف — الشرائح والمبالغ لا تتقابل بين التصنيفات.");
                }

                if (source.PricingKind == PartyFeePricingKinds.Flat)
                {
                    throw new InvalidOperationException(
                        "لا يمكن النسخ من جدول حوافز مقطوع إلى جدول أسعار أطراف.");
                }
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

 // Flat incentive tables are never the category default — that slot stays for cooperator rates.
        var isActive = pricingKind != PartyFeePricingKinds.Flat && !hasAnyInCategory;

 // Without a source to copy, the table is created unpriced (zeros / no tiers). Filling it in
 // is a deliberate act by whoever owns the rates, not something this service guesses.
        var table = new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = category,
            Name = name,
            PricingKind = pricingKind,
            ManagedBy = managedBy,
            IsActive = isActive,
            CourtVisitFeeSar = source?.CourtVisitFeeSar ?? 0m,
            FieldInspectorIndividualFeeSar = source?.FieldInspectorIndividualFeeSar ?? 0m,
            FieldInspectorOrganizationFeeSar = source?.FieldInspectorOrganizationFeeSar ?? 0m,
            FlatAmountSar = pricingKind == PartyFeePricingKinds.Flat
                ? Math.Max(0m, request.FlatAmountSar ?? 0m)
                : 0m,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        if (pricingKind == PartyFeePricingKinds.Tiered
            && category == PartyFeePricingCategories.EngineeringSurvey)
        {
            var sourceTiers = source?.AreaTiers
                .OrderBy(t => t.SortOrder)
                .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
                .ToList();
            if (EngineeringSurveyFeeRules.HasTiers(sourceTiers))
                ApplyTiersInMemory(table, sourceTiers!);
        }

        _db.PartyFeePricingTables.Add(table);
        AddAudit(
            actorId,
            "PRICING_TABLE_CREATED",
            nameof(PartyFeePricingTable),
            table.Id,
            before: null,
            after: Snapshot(table));
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
        var before = Snapshot(table);

        table.Name = NormalizeName(request.Name, table.Category);
        table.UpdatedAtUtc = DateTime.UtcNow;
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

        var now = DateTime.UtcNow;
        var sourceBefore = Snapshot(source);
        var wasSourceActive = source.IsActive;
 // Insert the revision inactive first. Postgres rejects an INSERT of an active row while
 // the previous category default is still active (IX_PartyFeePricingTables_Category_OneActive).
        var revision = new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = source.Category,
            Name = NormalizeName(request.Name, source.Category),
            PricingKind = source.PricingKind,
            ManagedBy = source.ManagedBy,
            IsActive = false,
            CourtVisitFeeSar = source.CourtVisitFeeSar,
            FieldInspectorIndividualFeeSar = source.FieldInspectorIndividualFeeSar,
            FieldInspectorOrganizationFeeSar = source.FieldInspectorOrganizationFeeSar,
            FlatAmountSar = source.FlatAmountSar,
            UpdatedAtUtc = now,
        };

        ApplyRatesInMemory(revision, request);

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
                Snapshot(source));
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
        var categoryAfter = categoryBefore
            .Select(a => a.TableId == sourceId
                ? a with { TableId = revision.Id }
                : a)
            .OrderBy(a => a.TableId)
            .ThenBy(a => a.AssigneeId)
            .ToList();
        AddAudit(
            actorId,
            "PRICING_TABLE_REVISED",
            nameof(PartyFeePricingTable),
            revision.Id,
            sourceBefore,
            Snapshot(revision));
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
            var revisionBeforeActivate = Snapshot(revision);
            revision.IsActive = true;
            revision.UpdatedAtUtc = DateTime.UtcNow;
            AddAudit(
                actorId,
                "PRICING_TABLE_ACTIVATED",
                nameof(PartyFeePricingTable),
                revision.Id,
                revisionBeforeActivate,
                Snapshot(revision));
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

 // Flat incentive tables are assigned to people; making one the category default would steal
 // the cooperator fallback and leave employees pricing out of the wrong kind.
        if (table.PricingKind == PartyFeePricingKinds.Flat)
        {
            throw new InvalidOperationException(
                "لا يمكن تفعيل جدول حوافز مقطوع كافتراضي للتصنيف — أسنده للأطراف مباشرة.");
        }

        var others = await _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .Where(x => x.Id != id && x.Category == table.Category && x.IsActive)
            .ToListAsync(cancellationToken);

 // Postgres filtered unique index IX_PartyFeePricingTables_Category_OneActive is checked
 // per statement. Activating before demoting the previous default in the same SaveChanges
 // batch briefly leaves two active rows and fails with 23505.
        var now = DateTime.UtcNow;
        foreach (var other in others)
        {
            var before = Snapshot(other);
            other.IsActive = false;
            other.UpdatedAtUtc = now;
            AddAudit(
                actorId,
                "PRICING_TABLE_DEACTIVATED",
                nameof(PartyFeePricingTable),
                other.Id,
                before,
                Snapshot(other));
        }

        if (others.Count > 0)
            await _db.SaveChangesAsync(cancellationToken);

        if (!table.IsActive)
        {
            var targetBefore = Snapshot(table);
            table.IsActive = true;
            table.UpdatedAtUtc = now;
            AddAudit(
                actorId,
                "PRICING_TABLE_ACTIVATED",
                nameof(PartyFeePricingTable),
                table.Id,
                targetBefore,
                Snapshot(table));
            await _db.SaveChangesAsync(cancellationToken);
        }

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
        var deletedSnapshot = Snapshot(table);
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
            var nextBefore = Snapshot(next);
            next.IsActive = true;
            next.UpdatedAtUtc = DateTime.UtcNow;
            AddAudit(
                actorId,
                "PRICING_TABLE_ACTIVATED",
                nameof(PartyFeePricingTable),
                next.Id,
                nextBefore,
                Snapshot(next));
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

        var normalized = assigneeIds
            .Select(id => (id ?? "").Trim())
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var categoryBefore = await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => a.Category == table.Category)
            .OrderBy(a => a.TableId)
            .ThenBy(a => a.AssigneeId)
            .Select(a => new PricingAssignmentSnapshot(a.TableId, a.AssigneeId))
            .ToListAsync(cancellationToken);

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
        var normalizedSet = normalized.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var categoryAfter = categoryBefore
            .Where(a =>
                a.TableId != tableId
                && !normalizedSet.Contains(a.AssigneeId))
            .Concat(normalized.Select(a => new PricingAssignmentSnapshot(tableId, a)))
            .OrderBy(a => a.TableId)
            .ThenBy(a => a.AssigneeId)
            .ToList();
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
        var category = CategoryForTaskKind(taskKind);
        if (category is null) return ResolvedPartyFee.Unresolved;

 // Employee incentives may only come from flat tables. An accidental party-rates assignment
 // (or the cooperator category default) must not silently leave the employee unpriced —
 // and must not price them from cooperator columns.
        PartyFeePricingDto? pricing;
        if (InspectorFeeRules.IsEmployee(partyType)
            && taskKind is WorkflowTaskKind.FieldInspection
                or WorkflowTaskKind.GovernmentReview)
        {
            pricing = await ResolveEmployeeIncentiveTableAsync(
                category,
                assigneeId,
                cancellationToken);
        }
        else
        {
            pricing = await ResolveTableDtoForAssigneeAsync(
                category,
                assigneeId,
                cancellationToken);
        }

        if (pricing is null) return ResolvedPartyFee.Unresolved;

        var fee = ResolveFromDto(pricing, taskKind, partyType, areaM2);

 // A table that priced nothing is not the source of anything, so it is not recorded as one.
        return fee is > 0m ? new ResolvedPartyFee(fee, pricing.Id) : ResolvedPartyFee.Unresolved;
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
                if (assigned is not null
                    && assigned.PricingKind == PartyFeePricingKinds.Flat
                    && assigned.FlatAmountSar > 0m)
                {
                    return await ToDtoAsync(assigned, cancellationToken);
                }
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

    public static decimal? ResolveFromDto(
        PartyFeePricingDto pricing,
        WorkflowTaskKind taskKind,
        string partyType,
        decimal? areaM2 = null)
    {
        if (taskKind == WorkflowTaskKind.EngineeringSurvey)
        {
            if (areaM2 is not > 0m) return null;
            var tiers = (pricing.AreaTiers ?? [])
                .OrderBy(t => t.SortOrder)
                .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
                .ToList();
            return EngineeringSurveyFeeRules.ResolveFeeFromTiers(areaM2.Value, tiers);
        }

 // Employee incentives only come from flat tables. A party-rates default must not silently
 // price them, and a flat table must not price cooperators out of cooperator columns.
        if (pricing.PricingKind == PartyFeePricingKinds.Flat)
        {
            return InspectorFeeRules.IsEmployee(partyType)
                ? Configured(pricing.FlatAmountSar)
                : null;
        }

        if (InspectorFeeRules.IsEmployee(partyType))
            return null;

        if (taskKind == WorkflowTaskKind.GovernmentReview)
            return Configured(pricing.CourtVisitFeeSar);

        return partyType switch
        {
            InspectorFeeRules.TypeCooperatorOrganization =>
                Configured(pricing.FieldInspectorOrganizationFeeSar),
            InspectorFeeRules.TypeCooperatorIndividual
                or InspectorFeeRules.TypeCooperatorLegacy =>
                Configured(pricing.FieldInspectorIndividualFeeSar),
            _ => null,
        };
    }

 /// <summary>
 /// An amount of zero means nobody set a rate, which is a different answer from "the rate is
 /// zero" — callers must treat it as unresolved and refuse to bill.
 /// </summary>
    private static decimal? Configured(decimal amount) => amount > 0m ? amount : null;

    private static string? CategoryForTaskKind(WorkflowTaskKind taskKind) => taskKind switch
    {
        WorkflowTaskKind.EngineeringSurvey => PartyFeePricingCategories.EngineeringSurvey,
        WorkflowTaskKind.GovernmentReview => PartyFeePricingCategories.CourtVisit,
        WorkflowTaskKind.FieldInspection => PartyFeePricingCategories.FieldInspector,
        _ => null,
    };

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
        var active = await _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .FirstOrDefaultAsync(x => x.Category == category && x.IsActive, cancellationToken);
        if (active is not null) return;

        var any = await _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .Where(x => x.Category == category && x.PricingKind != PartyFeePricingKinds.Flat)
            .OrderBy(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);
        if (any is not null)
        {
            var before = Snapshot(any);
            any.IsActive = true;
            any.UpdatedAtUtc = DateTime.UtcNow;
            AddAudit(
                "system",
                "PRICING_TABLE_ACTIVATED",
                nameof(PartyFeePricingTable),
                any.Id,
                before,
                Snapshot(any));
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
            UpdatedAtUtc = DateTime.UtcNow,
        };

        _db.PartyFeePricingTables.Add(table);
        AddAudit(
            "system",
            "PRICING_TABLE_CREATED",
            nameof(PartyFeePricingTable),
            table.Id,
            before: null,
            after: Snapshot(table));
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

 // Removed through the change tracker rather than ExecuteDelete so the old tiers and the new
 // ones land in one SaveChanges — a failure between the two would otherwise leave the table
 // with no schedule at all.
        var old = await _db.PartyFeePricingTiers
            .Where(t => t.TableId == table.Id)
            .ToListAsync(cancellationToken);
        _db.PartyFeePricingTiers.RemoveRange(old);

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

    private static IReadOnlyList<EngineeringSurveyFeeRules.AreaFeeTier> NormalizeRequestedTiers(
        PartyFeePricingDto request)
    {
        var incoming = (request.AreaTiers ?? [])
            .OrderBy(t => t.SortOrder)
            .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
            .ToList();
        if (!EngineeringSurveyFeeRules.HasTiers(incoming))
        {
            throw new InvalidOperationException(
                "جدول الرفع المساحي يجب أن يحتوي شريحة واحدة على الأقل.");
        }

        return EngineeringSurveyFeeRules.NormalizeTiers(incoming);
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

    private PricingTableSnapshot SnapshotFromTrackedState(PartyFeePricingTable table)
    {
        var tiers = _db.ChangeTracker.Entries<PartyFeePricingTier>()
            .Where(e => e.Entity.TableId == table.Id && e.State != EntityState.Deleted)
            .Select(e => e.Entity)
            .OrderBy(t => t.SortOrder)
            .Select(t => new PricingTierSnapshot(t.SortOrder, t.MaxAreaM2, t.FeeSar))
            .ToList();
        return Snapshot(table, tiers);
    }

    private static PricingTableSnapshot Snapshot(PartyFeePricingTable table) =>
        Snapshot(
            table,
            table.AreaTiers
                .OrderBy(t => t.SortOrder)
                .Select(t => new PricingTierSnapshot(t.SortOrder, t.MaxAreaM2, t.FeeSar))
                .ToList());

    private static PricingTableSnapshot Snapshot(
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

    private static void ValidateKindManagerPair(string pricingKind, string managedBy, string category)
    {
        if (pricingKind == PartyFeePricingKinds.Tiered
            && category != PartyFeePricingCategories.EngineeringSurvey)
        {
            throw new InvalidOperationException(
                "التسعير بالشرائح متاح لتصنيف الرفع المساحي فقط.");
        }

        if (pricingKind == PartyFeePricingKinds.Flat
            && category == PartyFeePricingCategories.EngineeringSurvey)
        {
            throw new InvalidOperationException(
                "حوافز المقطوع لا تُنشأ تحت تصنيف الرفع المساحي.");
        }

        if (managedBy == PartyFeePricingManagers.Supervisor
            && pricingKind != PartyFeePricingKinds.Flat)
        {
            throw new InvalidOperationException(
                "إدارة المشرف متاحة لجداول الحوافز المقطوعة فقط.");
        }
    }

    private async Task ApplyRatesFromRequestAsync(
        PartyFeePricingTable table,
        PartyFeePricingDto request,
        CancellationToken cancellationToken)
    {
        if (table.PricingKind == PartyFeePricingKinds.Flat)
        {
            var amount = Math.Max(0m, request.FlatAmountSar);
            if (amount <= 0m)
                throw new InvalidOperationException("مبلغ الحافز المقطوع مطلوب.");
            table.FlatAmountSar = amount;
            table.CourtVisitFeeSar = 0m;
            table.FieldInspectorIndividualFeeSar = 0m;
            table.FieldInspectorOrganizationFeeSar = 0m;
            await ReplaceTiersAsync(table, [], cancellationToken);
            return;
        }

        table.FlatAmountSar = 0m;
        switch (table.Category)
        {
            case PartyFeePricingCategories.EngineeringSurvey:
                await ReplaceTiersAsync(table, NormalizeRequestedTiers(request), cancellationToken);
                break;
            case PartyFeePricingCategories.CourtVisit:
                table.CourtVisitFeeSar = Math.Max(0m, request.CourtVisitFeeSar);
                break;
            case PartyFeePricingCategories.FieldInspector:
                table.FieldInspectorIndividualFeeSar =
                    Math.Max(0m, request.FieldInspectorIndividualFeeSar);
                table.FieldInspectorOrganizationFeeSar =
                    Math.Max(0m, request.FieldInspectorOrganizationFeeSar);
                break;
        }
    }

    private void ApplyRatesInMemory(PartyFeePricingTable table, PartyFeePricingDto request)
    {
        if (table.PricingKind == PartyFeePricingKinds.Flat)
        {
            var amount = Math.Max(0m, request.FlatAmountSar);
            if (amount <= 0m)
                throw new InvalidOperationException("مبلغ الحافز المقطوع مطلوب.");
            table.FlatAmountSar = amount;
            table.CourtVisitFeeSar = 0m;
            table.FieldInspectorIndividualFeeSar = 0m;
            table.FieldInspectorOrganizationFeeSar = 0m;
            table.AreaTiers.Clear();
            return;
        }

        table.FlatAmountSar = 0m;
        switch (table.Category)
        {
            case PartyFeePricingCategories.EngineeringSurvey:
                ApplyTiersInMemory(table, NormalizeRequestedTiers(request));
                break;
            case PartyFeePricingCategories.CourtVisit:
                table.CourtVisitFeeSar = Math.Max(0m, request.CourtVisitFeeSar);
                break;
            case PartyFeePricingCategories.FieldInspector:
                table.FieldInspectorIndividualFeeSar =
                    Math.Max(0m, request.FieldInspectorIndividualFeeSar);
                table.FieldInspectorOrganizationFeeSar =
                    Math.Max(0m, request.FieldInspectorOrganizationFeeSar);
                break;
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
            NormalizeActor(actorId),
            action,
            entityType,
            entityId.ToString(),
            before,
            after));
    }

    private static string NormalizeActor(string? actorId) =>
        string.IsNullOrWhiteSpace(actorId) ? "system" : actorId.Trim();

    private sealed record PricingTableSnapshot(
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

    private sealed record PricingTierSnapshot(
        int SortOrder,
        decimal? MaxAreaM2,
        decimal FeeSar);

    private sealed record PricingAssignmentSnapshot(Guid TableId, string AssigneeId);

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
 // An unpriced table stays visibly empty here so the pricing screen shows it needs setting up.
        var normalized = EngineeringSurveyFeeRules.HasTiers(tiers)
            ? EngineeringSurveyFeeRules.NormalizeTiers(tiers)
            : [];

        return new PartyFeePricingDto
        {
            Id = table.Id,
            Category = table.Category,
            Name = table.Name,
            PricingKind = table.PricingKind,
            ManagedBy = table.ManagedBy,
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
            CourtVisitFeeSar = table.CourtVisitFeeSar,
            FieldInspectorIndividualFeeSar = table.FieldInspectorIndividualFeeSar,
            FieldInspectorOrganizationFeeSar = table.FieldInspectorOrganizationFeeSar,
            FlatAmountSar = table.FlatAmountSar,
            UpdatedAtUtc = table.UpdatedAtUtc,
        };
    }
}
