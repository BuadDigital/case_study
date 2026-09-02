using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Party fee pricing decisions: what a pricing table is allowed to be, how a request lands on
/// one, and which table prices a given party. Pure — the service keeps the queries, the audit
/// writes and the SaveChanges.
/// </summary>
public static class PartyFeePricingRules
{
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
    public static decimal? Configured(decimal amount) => amount > 0m ? amount : null;

    public static string? CategoryForTaskKind(WorkflowTaskKind taskKind) => taskKind switch
    {
        WorkflowTaskKind.EngineeringSurvey => PartyFeePricingCategories.EngineeringSurvey,
        WorkflowTaskKind.GovernmentReview => PartyFeePricingCategories.CourtVisit,
        WorkflowTaskKind.FieldInspection => PartyFeePricingCategories.FieldInspector,
        _ => null,
    };

    public static IReadOnlyList<EngineeringSurveyFeeRules.AreaFeeTier> NormalizeRequestedTiers(
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

    public static void ApplyTiersInMemory(
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

    public static void ValidateKindManagerPair(string pricingKind, string managedBy, string category)
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

    public static string NormalizeActor(string? actorId) =>
        string.IsNullOrWhiteSpace(actorId) ? "system" : actorId.Trim();

    public static string NormalizeName(string? name, string category)
    {
        var trimmed = (name ?? "").Trim();
        if (!string.IsNullOrEmpty(trimmed))
            return trimmed[..Math.Min(trimmed.Length, 128)];

        return "افتراضي";
    }

    /// <summary>The category, name, kind and manager a create request resolves to.</summary>
    public sealed record NewTableShape(
        string Category,
        string Name,
        string PricingKind,
        string ManagedBy);

    /// <summary>
    /// Reads a create request into the four fields that decide what the table is, filling the
    /// defaults each category implies, and rejects kind/manager pairs that cannot exist.
    /// </summary>
    public static NewTableShape ResolveNewTableShape(CreatePartyFeePricingTableRequest request)
    {
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
        return new NewTableShape(category, name, pricingKind, managedBy);
    }

    /// <summary>
    /// An explicit copy request that cannot be honoured must fail — silently starting from
    /// another table would hand the new table rates the caller never asked for.
    /// </summary>
    public static void ValidateCopySource(PartyFeePricingTable source, string category)
    {
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

    /// <summary>
    /// Flat incentive tables are never the category default — that slot stays for cooperator
    /// rates — so only the first party-rates table in a category starts active.
    /// </summary>
    public static bool IsCategoryDefaultOnCreate(string pricingKind, bool hasAnyInCategory) =>
        pricingKind != PartyFeePricingKinds.Flat && !hasAnyInCategory;

    /// <summary>
    /// The new table, copying the source rates when there is one. Without a source it is created
    /// unpriced (zeros / no tiers): filling it in is a deliberate act by whoever owns the rates,
    /// not something this rule guesses.
    /// </summary>
    public static PartyFeePricingTable BuildNewTable(
        NewTableShape shape,
        PartyFeePricingTable? source,
        decimal? requestedFlatAmountSar,
        bool isActive,
        DateTime nowUtc)
    {
        var table = new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = shape.Category,
            Name = shape.Name,
            PricingKind = shape.PricingKind,
            ManagedBy = shape.ManagedBy,
            IsActive = isActive,
            CourtVisitFeeSar = source?.CourtVisitFeeSar ?? 0m,
            FieldInspectorIndividualFeeSar = source?.FieldInspectorIndividualFeeSar ?? 0m,
            FieldInspectorOrganizationFeeSar = source?.FieldInspectorOrganizationFeeSar ?? 0m,
            FlatAmountSar = shape.PricingKind == PartyFeePricingKinds.Flat
                ? Math.Max(0m, requestedFlatAmountSar ?? 0m)
                : 0m,
            UpdatedAtUtc = nowUtc,
        };

        if (shape.PricingKind == PartyFeePricingKinds.Tiered
            && shape.Category == PartyFeePricingCategories.EngineeringSurvey)
        {
            var sourceTiers = ReadTiers(source?.AreaTiers);
            if (EngineeringSurveyFeeRules.HasTiers(sourceTiers))
                ApplyTiersInMemory(table, sourceTiers);
        }

        return table;
    }

    /// <summary>
    /// A revision starts inactive: Postgres rejects an INSERT of an active row while the previous
    /// category default is still active (IX_PartyFeePricingTables_Category_OneActive).
    /// </summary>
    public static PartyFeePricingTable BuildRevision(
        PartyFeePricingTable source,
        PartyFeePricingDto request,
        DateTime nowUtc)
    {
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
            UpdatedAtUtc = nowUtc,
        };
        ApplyRatesInMemory(revision, request);
        return revision;
    }

    /// <summary>Revising moves every assignment of the source onto the revision.</summary>
    public static List<PricingAssignmentSnapshot> RelinkedAssignments(
        IEnumerable<PricingAssignmentSnapshot> categoryBefore,
        Guid sourceId,
        Guid revisionId) =>
        categoryBefore
            .Select(a => a.TableId == sourceId ? a with { TableId = revisionId } : a)
            .OrderBy(a => a.TableId)
            .ThenBy(a => a.AssigneeId)
            .ToList();

    /// <summary>Assignee ids are compared case-insensitively and a party appears once.</summary>
    public static List<string> NormalizeAssigneeIds(IEnumerable<string?> assigneeIds) =>
        assigneeIds
            .Select(id => (id ?? "").Trim())
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    /// <summary>
    /// Setting the assignees of a table takes those parties off every other table in the
    /// category, so the picture afterwards drops them from wherever they were.
    /// </summary>
    public static List<PricingAssignmentSnapshot> AssignmentsAfterReplace(
        IEnumerable<PricingAssignmentSnapshot> categoryBefore,
        Guid tableId,
        IReadOnlyList<string> normalizedAssigneeIds)
    {
        var normalizedSet = normalizedAssigneeIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return categoryBefore
            .Where(a => a.TableId != tableId && !normalizedSet.Contains(a.AssigneeId))
            .Concat(normalizedAssigneeIds.Select(a => new PricingAssignmentSnapshot(tableId, a)))
            .OrderBy(a => a.TableId)
            .ThenBy(a => a.AssigneeId)
            .ToList();
    }

    /// <summary>
    /// Flat incentive tables are assigned to people; making one the category default would steal
    /// the cooperator fallback and leave employees pricing out of the wrong kind.
    /// </summary>
    public static void ValidateActivatable(PartyFeePricingTable table)
    {
        if (table.PricingKind == PartyFeePricingKinds.Flat)
        {
            throw new InvalidOperationException(
                "لا يمكن تفعيل جدول حوافز مقطوع كافتراضي للتصنيف — أسنده للأطراف مباشرة.");
        }
    }

    /// <summary>Employee incentives may only ever come from a flat table.</summary>
    public static bool UsesEmployeeIncentiveTable(string partyType, WorkflowTaskKind taskKind) =>
        InspectorFeeRules.IsEmployee(partyType)
        && taskKind is WorkflowTaskKind.FieldInspection or WorkflowTaskKind.GovernmentReview;

    /// <summary>A flat table only prices an employee once somebody set an amount on it.</summary>
    public static bool IsUsableEmployeeIncentiveTable(PartyFeePricingTable? table) =>
        table is not null
        && table.PricingKind == PartyFeePricingKinds.Flat
        && table.FlatAmountSar > 0m;

    /// <summary>
    /// Engineering office: no table until explicitly assigned, so an unassigned office never
    /// falls back to the category default.
    /// </summary>
    public static bool AllowsCategoryDefaultFallback(string category) =>
        category != PartyFeePricingCategories.EngineeringSurvey;

    /// <summary>A table that priced nothing is not the source of anything, so it is not recorded.</summary>
    public static ResolvedPartyFee ResolvedOrUnresolved(decimal? fee, Guid tableId) =>
        fee is > 0m ? new ResolvedPartyFee(fee, tableId) : ResolvedPartyFee.Unresolved;

    /// <summary>The flat amount a table must carry to save; zero means nobody set a rate.</summary>
    public static decimal RequireFlatAmount(decimal requested)
    {
        var amount = Math.Max(0m, requested);
        if (amount <= 0m)
            throw new InvalidOperationException("مبلغ الحافز المقطوع مطلوب.");
        return amount;
    }

    /// <summary>Applies the single amount of a flat table and clears every party-rate column.</summary>
    public static void ApplyFlatRate(PartyFeePricingTable table, decimal requestedFlatAmountSar)
    {
        table.FlatAmountSar = RequireFlatAmount(requestedFlatAmountSar);
        table.CourtVisitFeeSar = 0m;
        table.FieldInspectorIndividualFeeSar = 0m;
        table.FieldInspectorOrganizationFeeSar = 0m;
    }

    /// <summary>Applies the scalar party rates a category uses; tiers are handled separately.</summary>
    public static void ApplyCategoryRates(PartyFeePricingTable table, PartyFeePricingDto request)
    {
        table.FlatAmountSar = 0m;
        switch (table.Category)
        {
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

    /// <summary>Whether a save has to rewrite the area tiers of the table from the request.</summary>
    public static bool UsesAreaTiers(PartyFeePricingTable table) =>
        table.PricingKind != PartyFeePricingKinds.Flat
        && table.Category == PartyFeePricingCategories.EngineeringSurvey;

    /// <summary>The in-memory (no EF) form of a rate save, used when building a revision.</summary>
    public static void ApplyRatesInMemory(PartyFeePricingTable table, PartyFeePricingDto request)
    {
        if (table.PricingKind == PartyFeePricingKinds.Flat)
        {
            ApplyFlatRate(table, request.FlatAmountSar);
            table.AreaTiers.Clear();
            return;
        }

        ApplyCategoryRates(table, request);
        if (UsesAreaTiers(table))
            ApplyTiersInMemory(table, NormalizeRequestedTiers(request));
    }

    /// <summary>Persisted tier rows for a table, renumbered from the normalized schedule.</summary>
    public static List<PartyFeePricingTier> BuildTierRows(
        Guid tableId,
        IReadOnlyList<EngineeringSurveyFeeRules.AreaFeeTier> tiers) =>
        EngineeringSurveyFeeRules.NormalizeTiers(tiers)
            .Select((t, i) => new PartyFeePricingTier
            {
                Id = Guid.NewGuid(),
                TableId = tableId,
                SortOrder = i,
                MaxAreaM2 = t.MaxAreaM2,
                FeeSar = t.FeeSar,
            })
            .ToList();

    /// <summary>Reads stored tier rows back into the ordered schedule the fee rules use.</summary>
    public static List<EngineeringSurveyFeeRules.AreaFeeTier> ReadTiers(
        IEnumerable<PartyFeePricingTier>? rows) =>
        (rows ?? [])
            .OrderBy(t => t.SortOrder)
            .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
            .ToList();

    /// <summary>Projects a loaded table plus its assignees into the pricing screen DTO.</summary>
    public static PartyFeePricingDto ToDto(
        PartyFeePricingTable table,
        IReadOnlyList<string> assigneeIds)
    {
        var tiers = ReadTiers(table.AreaTiers);
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
            AssignedAssigneeIds = [.. assigneeIds],
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
