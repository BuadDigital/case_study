using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Lifecycle guards and row edits of a pricing table: what may be edited, revised, or deleted
/// given its links, the active-flag flip with its audit before-image, the assignment row, and
/// the list projection. Pure — the service runs the queries and the audited saves.
/// </summary>
public static class PartyFeePricingLifecycleRules
{
    /// <summary>A linked table is edited through a revision, never in place.</summary>
    public static void RequireEditable(bool hasAssignments)
    {
        if (hasAssignments)
        {
            throw new InvalidOperationException(
                "لا يمكن تعديل جدول مرتبط بأطراف — احفظ التغيير كنسخة جديدة لإعادة ربطهم ذرّياً.");
        }
    }

    /// <summary>A revision only exists to relink parties; an unlinked table is edited directly.</summary>
    public static void RequireRevisable(int assignmentCount)
    {
        if (assignmentCount == 0)
        {
            throw new InvalidOperationException(
                "الجدول غير مرتبط بأطراف ويمكن تعديله مباشرة دون إنشاء نسخة.");
        }
    }

    /// <summary>Every category keeps at least one table.</summary>
    public static void RequireNotLastInCategory(int countInCategory)
    {
        if (countInCategory <= 1)
            throw new InvalidOperationException("Cannot delete the last pricing table in this category.");
    }

    /// <summary>A linked table cannot be deleted from under its parties.</summary>
    public static void RequireDeletable(bool hasAssignments)
    {
        if (hasAssignments)
        {
            throw new InvalidOperationException(
                "لا يمكن حذف جدول مرتبط بأطراف — انقل الإسنادات أولاً.");
        }
    }

    /// <summary>Flips the active flag and stamps the table; returns the before-image for the audit row.</summary>
    public static PricingTableSnapshot SetActive(PartyFeePricingTable table, bool isActive, DateTime nowUtc)
    {
        var before = PartyFeePricingSnapshots.Snapshot(table);
        table.IsActive = isActive;
        table.UpdatedAtUtc = nowUtc;
        return before;
    }

    public static PartyFeePricingAssignment NewAssignment(
        Guid tableId,
        string category,
        string assigneeId,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            TableId = tableId,
            Category = category,
            AssigneeId = assigneeId,
            UpdatedAtUtc = nowUtc,
        };

    /// <summary>Tier rows as the audit snapshot records them.</summary>
    public static List<PricingTierSnapshot> TierSnapshots(IEnumerable<PartyFeePricingTier> tiers) =>
        tiers
            .Select(t => new PricingTierSnapshot(t.SortOrder, t.MaxAreaM2, t.FeeSar))
            .ToList();

    /// <summary>The list row; the assignment count is filled in afterwards from its own query.</summary>
    public static PartyFeePricingTableSummaryDto ToSummaryDto(PricingTableSummaryRow row) => new()
    {
        Id = row.Id,
        Category = row.Category,
        Name = row.Name,
        PricingKind = row.PricingKind,
        ManagedBy = row.ManagedBy,
        IsActive = row.IsActive,
        UpdatedAtUtc = row.UpdatedAtUtc,
    };
}
