using RealEstateEval.Application.Rules;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>Lifecycle guards and row edits extracted out of PartyFeePricingService.</summary>
public class PartyFeePricingLifecycleRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 2, 8, 0, 0, DateTimeKind.Utc);

    private static PartyFeePricingTable Table(bool isActive = false) => new()
    {
        Id = Guid.NewGuid(),
        Category = PartyFeePricingCategories.CourtVisit,
        Name = "افتراضي",
        PricingKind = PartyFeePricingKinds.PartyRates,
        ManagedBy = PartyFeePricingManagers.SystemAdmin,
        IsActive = isActive,
        CourtVisitFeeSar = 250m,
        UpdatedAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
    };

    [Fact]
    public void A_linked_table_is_not_edited_in_place()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => PartyFeePricingLifecycleRules.RequireEditable(hasAssignments: true));
        Assert.Equal(
            "لا يمكن تعديل جدول مرتبط بأطراف — احفظ التغيير كنسخة جديدة لإعادة ربطهم ذرّياً.",
            ex.Message);

        PartyFeePricingLifecycleRules.RequireEditable(hasAssignments: false);
    }

    [Fact]
    public void An_unlinked_table_is_not_revised()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => PartyFeePricingLifecycleRules.RequireRevisable(0));
        Assert.Equal("الجدول غير مرتبط بأطراف ويمكن تعديله مباشرة دون إنشاء نسخة.", ex.Message);

        PartyFeePricingLifecycleRules.RequireRevisable(2);
    }

    [Fact]
    public void The_last_table_of_a_category_stays()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => PartyFeePricingLifecycleRules.RequireNotLastInCategory(1));
        Assert.Equal("Cannot delete the last pricing table in this category.", ex.Message);

        PartyFeePricingLifecycleRules.RequireNotLastInCategory(2);
    }

    [Fact]
    public void A_linked_table_is_not_deleted()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => PartyFeePricingLifecycleRules.RequireDeletable(hasAssignments: true));
        Assert.Equal("لا يمكن حذف جدول مرتبط بأطراف — انقل الإسنادات أولاً.", ex.Message);

        PartyFeePricingLifecycleRules.RequireDeletable(hasAssignments: false);
    }

    [Fact]
    public void Set_active_flips_the_flag_and_returns_the_before_image()
    {
        var table = Table(isActive: false);

        var before = PartyFeePricingLifecycleRules.SetActive(table, true, Now);

        Assert.False(before.IsActive);
        Assert.Equal(table.Id, before.Id);
        Assert.Equal(250m, before.CourtVisitFeeSar);
        Assert.True(table.IsActive);
        Assert.Equal(Now, table.UpdatedAtUtc);
    }

    [Fact]
    public void New_assignment_links_the_party_to_the_table_in_its_category()
    {
        var tableId = Guid.NewGuid();
        var assignment = PartyFeePricingLifecycleRules.NewAssignment(
            tableId, PartyFeePricingCategories.FieldInspector, "eo-1", Now);

        Assert.NotEqual(Guid.Empty, assignment.Id);
        Assert.Equal(tableId, assignment.TableId);
        Assert.Equal(PartyFeePricingCategories.FieldInspector, assignment.Category);
        Assert.Equal("eo-1", assignment.AssigneeId);
        Assert.Equal(Now, assignment.UpdatedAtUtc);
    }

    [Fact]
    public void Tier_snapshots_keep_order_bounds_and_fees()
    {
        var snapshots = PartyFeePricingLifecycleRules.TierSnapshots(
        [
            new PartyFeePricingTier { SortOrder = 0, MaxAreaM2 = 500m, FeeSar = 300m },
            new PartyFeePricingTier { SortOrder = 1, MaxAreaM2 = null, FeeSar = 450m },
        ]);

        Assert.Equal(2, snapshots.Count);
        Assert.Equal(new PricingTierSnapshot(0, 500m, 300m), snapshots[0]);
        Assert.Equal(new PricingTierSnapshot(1, null, 450m), snapshots[1]);
    }

    [Fact]
    public void Summary_dto_mirrors_the_row_and_leaves_the_count_for_later()
    {
        var id = Guid.NewGuid();
        var dto = PartyFeePricingLifecycleRules.ToSummaryDto(new PricingTableSummaryRow(
            id,
            PartyFeePricingCategories.EngineeringSurvey,
            "مكاتب",
            PartyFeePricingKinds.Tiered,
            PartyFeePricingManagers.SystemAdmin,
            true,
            Now));

        Assert.Equal(id, dto.Id);
        Assert.Equal(PartyFeePricingCategories.EngineeringSurvey, dto.Category);
        Assert.Equal("مكاتب", dto.Name);
        Assert.Equal(PartyFeePricingKinds.Tiered, dto.PricingKind);
        Assert.Equal(PartyFeePricingManagers.SystemAdmin, dto.ManagedBy);
        Assert.True(dto.IsActive);
        Assert.Equal(Now, dto.UpdatedAtUtc);
        Assert.Equal(0, dto.AssignedCount);
    }
}
