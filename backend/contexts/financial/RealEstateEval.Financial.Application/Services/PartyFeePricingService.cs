using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Party-fee pricing use case: table CRUD, category activation, assignee links, and default-fee
/// resolution. Persistence is <see cref="IPartyFeePricingRepository"/>, so this class never
/// opens EF.
/// </summary>
public sealed partial class PartyFeePricingService : IPartyFeePricingService
{
    private const int MaxPricingTables = 100;
    public static readonly Guid DefaultEngineeringTableId =
        Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    public static readonly Guid DefaultCourtVisitTableId =
        Guid.Parse("b2c3d4e5-f6a7-8901-bcde-f12345678901");

    public static readonly Guid DefaultInspectorTableId =
        Guid.Parse("c3d4e5f6-a7b8-9012-cdef-123456789012");

    private readonly IPartyFeePricingRepository _db;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    public PartyFeePricingService(
        IPartyFeePricingRepository db,
        IAuditLogWriter audit,
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

        var rows = await _db.ListTableSummariesAsync(
            normalizedCategory,
            MaxPricingTables,
            cancellationToken);

        var tables = rows.Select(PartyFeePricingLifecycleRules.ToSummaryDto).ToList();

        if (tables.Count == 0) return tables;

        var countByTable = await _db.CountAssignmentsByTableAsync(
            tables.Select(t => t.Id).ToList(),
            cancellationToken);

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
                source = await _db.FindRateSourceTableAsync(category, cancellationToken);
            }
        }

        var hasAnyInCategory = await _db.AnyTableInCategoryAsync(category, cancellationToken);

        var table = PartyFeePricingRules.BuildNewTable(
            shape,
            source,
            request.FlatAmountSar,
            PartyFeePricingRules.IsCategoryDefaultOnCreate(pricingKind, hasAnyInCategory),
            _time.UtcNow());

        _db.AddTable(table);
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
        PartyFeePricingLifecycleRules.RequireEditable(
            await _db.AnyAssignmentsForTableAsync(id, cancellationToken));
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
        var assignments = await _db.ListAssignmentsForTableAsync(sourceId, cancellationToken);
        PartyFeePricingLifecycleRules.RequireRevisable(assignments.Count);

        var now = _time.UtcNow();
        var sourceBefore = PartyFeePricingSnapshots.Snapshot(source);
        var wasSourceActive = source.IsActive;
        var revision = PartyFeePricingRules.BuildRevision(source, request, now);

        if (wasSourceActive)
        {
            PartyFeePricingLifecycleRules.SetActive(source, false, now);
            AddAudit(
                actorId,
                "PRICING_TABLE_DEACTIVATED",
                nameof(PartyFeePricingTable),
                source.Id,
                sourceBefore,
                PartyFeePricingSnapshots.Snapshot(source));
        }

        var categoryBefore = await _db.ListAssignmentSnapshotsByCategoryAsync(
            source.Category, cancellationToken);
        foreach (var assignment in assignments)
        {
            assignment.TableId = revision.Id;
            assignment.UpdatedAtUtc = now;
        }

        _db.AddTable(revision);
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
            var revisionBeforeActivate = PartyFeePricingLifecycleRules.SetActive(
                revision, true, _time.UtcNow());
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

        var others = await _db.ListActiveTablesInCategoryAsync(
            table.Category, id, cancellationToken);

 // Postgres filtered unique index IX_PartyFeePricingTables_Category_OneActive is checked
 // per statement. Deactivate others in one SaveChanges, then activate in a second pass,
 // inside one transaction so a failed activation rolls back the demotions too.
        var now = _time.UtcNow();
        await _db.ExecuteInTransactionAsync(async ct =>
        {
            foreach (var other in others)
            {
                var before = PartyFeePricingLifecycleRules.SetActive(other, false, now);
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
                var targetBefore = PartyFeePricingLifecycleRules.SetActive(table, true, now);
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

        PartyFeePricingLifecycleRules.RequireNotLastInCategory(
            await _db.CountTablesInCategoryAsync(table.Category, cancellationToken));
        PartyFeePricingLifecycleRules.RequireDeletable(
            await _db.AnyAssignmentsForTableAsync(id, cancellationToken));

        var wasActive = table.IsActive;
        var category = table.Category;
        var deletedSnapshot = PartyFeePricingSnapshots.Snapshot(table);
        _db.RemoveTable(table);

 // Promote the next table in the same SaveChanges so a failure cannot leave the
 // category without an active pricing table.
        if (wasActive)
        {
            var next = await _db.FindNextTableInCategoryAsync(category, id, cancellationToken)
                ?? throw new InvalidOperationException(
                    "Cannot delete the last pricing table in this category.");
            var nextBefore = PartyFeePricingLifecycleRules.SetActive(next, true, _time.UtcNow());
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

    private Task<PartyFeePricingTable?> LoadTableAsync(
        Guid id,
        bool tracking,
        CancellationToken cancellationToken) =>
        _db.GetTableAsync(id, tracking, cancellationToken);

    private async Task ReplaceTiersAsync(
        PartyFeePricingTable table,
        IReadOnlyList<EngineeringSurveyFeeRules.AreaFeeTier> tiers,
        CancellationToken cancellationToken)
    {
 // Removed through the change tracker rather than ExecuteDelete so the old tiers and the new
 // ones land in one SaveChanges — a failure between the two would otherwise leave the table
 // with no schedule at all.
        var old = await _db.ListTiersForTableAsync(table.Id, cancellationToken);
        _db.RemoveTiers(old);
        _db.AddTiers(PartyFeePricingRules.BuildTierRows(table.Id, tiers));
    }

    private PricingTableSnapshot SnapshotFromTrackedState(PartyFeePricingTable table) =>
        PartyFeePricingSnapshots.Snapshot(
            table,
            PartyFeePricingLifecycleRules.TierSnapshots(_db.ListPendingTiers(table.Id)));

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
        _db.AddAuditLog(_audit.Create(
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
        var assigneeIds = await _db.ListAssigneeIdsForTableAsync(table.Id, cancellationToken);

        return PartyFeePricingRules.ToDto(table, assigneeIds);
    }
}
