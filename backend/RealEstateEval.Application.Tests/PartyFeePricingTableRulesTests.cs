using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>Table-shape rules extracted out of PartyFeePricingService.</summary>
public class PartyFeePricingTableRulesTests
{
    private static PartyFeePricingTable Table(
        string category = PartyFeePricingCategories.FieldInspector,
        string kind = PartyFeePricingKinds.PartyRates,
        decimal flat = 0m) => new()
        {
            Id = Guid.NewGuid(),
            Category = category,
            Name = "افتراضي",
            PricingKind = kind,
            ManagedBy = PartyFeePricingManagers.SystemAdmin,
            FlatAmountSar = flat,
        };

    // ---- create shape ----

    [Fact]
    public void New_table_shape_fills_the_category_defaults()
    {
        var shape = PartyFeePricingRules.ResolveNewTableShape(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "   ",
        });

        Assert.Equal(PartyFeePricingCategories.FieldInspector, shape.Category);
        Assert.Equal("افتراضي", shape.Name);
        Assert.Equal(
            PartyFeePricingKinds.DefaultForCategory(PartyFeePricingCategories.FieldInspector),
            shape.PricingKind);
        Assert.Equal(PartyFeePricingManagers.SystemAdmin, shape.ManagedBy);
    }

    [Fact]
    public void A_flat_table_defaults_to_supervisor_management()
    {
        var shape = PartyFeePricingRules.ResolveNewTableShape(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "حوافز",
            PricingKind = PartyFeePricingKinds.Flat,
        });

        Assert.Equal(PartyFeePricingManagers.Supervisor, shape.ManagedBy);
    }

    [Fact]
    public void Tiered_pricing_is_engineering_survey_only()
    {
        Assert.Throws<InvalidOperationException>(() =>
            PartyFeePricingRules.ResolveNewTableShape(new CreatePartyFeePricingTableRequest
            {
                Category = PartyFeePricingCategories.CourtVisit,
                PricingKind = PartyFeePricingKinds.Tiered,
            }));
    }

    [Fact]
    public void Flat_incentives_are_never_created_under_engineering_survey()
    {
        Assert.Throws<InvalidOperationException>(() =>
            PartyFeePricingRules.ResolveNewTableShape(new CreatePartyFeePricingTableRequest
            {
                Category = PartyFeePricingCategories.EngineeringSurvey,
                PricingKind = PartyFeePricingKinds.Flat,
            }));
    }

    [Fact]
    public void Supervisor_management_is_only_for_flat_tables()
    {
        Assert.Throws<InvalidOperationException>(() =>
            PartyFeePricingRules.ResolveNewTableShape(new CreatePartyFeePricingTableRequest
            {
                Category = PartyFeePricingCategories.FieldInspector,
                PricingKind = PartyFeePricingKinds.PartyRates,
                ManagedBy = PartyFeePricingManagers.Supervisor,
            }));
    }

    [Fact]
    public void A_copy_source_must_match_the_category_and_not_be_flat()
    {
        var category = PartyFeePricingCategories.FieldInspector;

        Assert.Throws<InvalidOperationException>(() =>
            PartyFeePricingRules.ValidateCopySource(
                Table(PartyFeePricingCategories.CourtVisit),
                category));
        Assert.Throws<InvalidOperationException>(() =>
            PartyFeePricingRules.ValidateCopySource(
                Table(category, PartyFeePricingKinds.Flat),
                category));

        PartyFeePricingRules.ValidateCopySource(Table(category), category);
    }

    [Theory]
    [InlineData(PartyFeePricingKinds.PartyRates, false, true)]
    [InlineData(PartyFeePricingKinds.PartyRates, true, false)]
    [InlineData(PartyFeePricingKinds.Flat, false, false)]
    public void Only_the_first_party_rates_table_becomes_the_category_default(
        string kind,
        bool hasAny,
        bool expected)
    {
        Assert.Equal(expected, PartyFeePricingRules.IsCategoryDefaultOnCreate(kind, hasAny));
    }

    [Fact]
    public void A_new_table_without_a_source_is_created_unpriced()
    {
        var shape = new PartyFeePricingRules.NewTableShape(
            PartyFeePricingCategories.FieldInspector,
            "جديد",
            PartyFeePricingKinds.PartyRates,
            PartyFeePricingManagers.SystemAdmin);
        var now = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        var table = PartyFeePricingRules.BuildNewTable(shape, null, null, isActive: true, now);

        Assert.Equal(0m, table.FieldInspectorIndividualFeeSar);
        Assert.Equal(0m, table.FlatAmountSar);
        Assert.Empty(table.AreaTiers);
        Assert.True(table.IsActive);
        Assert.Equal(now, table.UpdatedAtUtc);
    }

    [Fact]
    public void A_new_table_copies_the_rates_and_tiers_of_its_source()
    {
        var source = Table(PartyFeePricingCategories.EngineeringSurvey, PartyFeePricingKinds.Tiered);
        source.FieldInspectorIndividualFeeSar = 250m;
        source.AreaTiers.Add(new PartyFeePricingTier { SortOrder = 0, MaxAreaM2 = 500m, FeeSar = 300m });
        source.AreaTiers.Add(new PartyFeePricingTier { SortOrder = 1, MaxAreaM2 = null, FeeSar = 900m });

        var shape = new PartyFeePricingRules.NewTableShape(
            PartyFeePricingCategories.EngineeringSurvey,
            "نسخة",
            PartyFeePricingKinds.Tiered,
            PartyFeePricingManagers.SystemAdmin);

        var table = PartyFeePricingRules.BuildNewTable(
            shape,
            source,
            null,
            isActive: false,
            DateTime.UtcNow);

        Assert.Equal(250m, table.FieldInspectorIndividualFeeSar);
        Assert.Equal(2, table.AreaTiers.Count);
        Assert.Equal(table.Id, table.AreaTiers.First().TableId);
    }

    [Fact]
    public void A_new_flat_table_clamps_a_negative_amount_to_zero()
    {
        var shape = new PartyFeePricingRules.NewTableShape(
            PartyFeePricingCategories.FieldInspector,
            "حوافز",
            PartyFeePricingKinds.Flat,
            PartyFeePricingManagers.Supervisor);

        var table = PartyFeePricingRules.BuildNewTable(shape, null, -5m, false, DateTime.UtcNow);
        Assert.Equal(0m, table.FlatAmountSar);
    }

    // ---- revisions and assignments ----

    [Fact]
    public void A_revision_starts_inactive_and_carries_the_source_identity()
    {
        var source = Table(PartyFeePricingCategories.CourtVisit);
        source.IsActive = true;
        source.CourtVisitFeeSar = 100m;
        var now = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);

        var revision = PartyFeePricingRules.BuildRevision(
            source,
            new PartyFeePricingDto { Name = " مراجعة ", CourtVisitFeeSar = 175m },
            now);

        Assert.NotEqual(source.Id, revision.Id);
        Assert.False(revision.IsActive);
        Assert.Equal(source.Category, revision.Category);
        Assert.Equal(source.PricingKind, revision.PricingKind);
        Assert.Equal("مراجعة", revision.Name);
        Assert.Equal(175m, revision.CourtVisitFeeSar);
        Assert.Equal(now, revision.UpdatedAtUtc);
    }

    [Fact]
    public void Relinking_moves_only_the_assignments_of_the_revised_table()
    {
        var sourceId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var revisionId = Guid.NewGuid();
        var before = new List<PricingAssignmentSnapshot>
        {
            new(sourceId, "a"),
            new(otherId, "b"),
        };

        var after = PartyFeePricingRules.RelinkedAssignments(before, sourceId, revisionId);

        Assert.Contains(after, a => a.TableId == revisionId && a.AssigneeId == "a");
        Assert.Contains(after, a => a.TableId == otherId && a.AssigneeId == "b");
        Assert.DoesNotContain(after, a => a.TableId == sourceId);
    }

    [Fact]
    public void Assignee_ids_are_trimmed_deduped_case_insensitively()
    {
        var normalized = PartyFeePricingRules.NormalizeAssigneeIds([" A ", "a", "", null, "b"]);
        Assert.Equal(["A", "b"], normalized);
    }

    [Fact]
    public void Replacing_assignments_pulls_the_parties_off_every_other_table()
    {
        var tableId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var before = new List<PricingAssignmentSnapshot>
        {
            new(otherId, "moved"),
            new(otherId, "stays"),
            new(tableId, "dropped"),
        };

        var after = PartyFeePricingRules.AssignmentsAfterReplace(before, tableId, ["moved", "new"]);

        Assert.Contains(after, a => a.TableId == tableId && a.AssigneeId == "moved");
        Assert.Contains(after, a => a.TableId == tableId && a.AssigneeId == "new");
        Assert.Contains(after, a => a.TableId == otherId && a.AssigneeId == "stays");
        Assert.DoesNotContain(after, a => a.AssigneeId == "dropped");
    }

    [Fact]
    public void A_flat_table_cannot_become_the_category_default()
    {
        Assert.Throws<InvalidOperationException>(() =>
            PartyFeePricingRules.ValidateActivatable(
                Table(PartyFeePricingCategories.FieldInspector, PartyFeePricingKinds.Flat)));
        PartyFeePricingRules.ValidateActivatable(Table());
    }

    // ---- rate application ----

    [Fact]
    public void A_flat_table_needs_a_positive_amount()
    {
        Assert.Throws<InvalidOperationException>(() => PartyFeePricingRules.RequireFlatAmount(0m));
        Assert.Throws<InvalidOperationException>(() => PartyFeePricingRules.RequireFlatAmount(-3m));
        Assert.Equal(120m, PartyFeePricingRules.RequireFlatAmount(120m));
    }

    [Fact]
    public void Applying_a_flat_rate_clears_the_party_rate_columns()
    {
        var table = Table(PartyFeePricingCategories.FieldInspector, PartyFeePricingKinds.Flat);
        table.CourtVisitFeeSar = 50m;
        table.FieldInspectorIndividualFeeSar = 60m;
        table.FieldInspectorOrganizationFeeSar = 70m;

        PartyFeePricingRules.ApplyFlatRate(table, 400m);

        Assert.Equal(400m, table.FlatAmountSar);
        Assert.Equal(0m, table.CourtVisitFeeSar);
        Assert.Equal(0m, table.FieldInspectorIndividualFeeSar);
        Assert.Equal(0m, table.FieldInspectorOrganizationFeeSar);
    }

    [Fact]
    public void Category_rates_are_clamped_and_only_touch_their_own_columns()
    {
        var courtVisit = Table(PartyFeePricingCategories.CourtVisit);
        PartyFeePricingRules.ApplyCategoryRates(
            courtVisit,
            new PartyFeePricingDto { CourtVisitFeeSar = -10m });
        Assert.Equal(0m, courtVisit.CourtVisitFeeSar);

        var inspector = Table();
        PartyFeePricingRules.ApplyCategoryRates(
            inspector,
            new PartyFeePricingDto
            {
                FieldInspectorIndividualFeeSar = 210m,
                FieldInspectorOrganizationFeeSar = 340m,
                CourtVisitFeeSar = 999m,
            });
        Assert.Equal(210m, inspector.FieldInspectorIndividualFeeSar);
        Assert.Equal(340m, inspector.FieldInspectorOrganizationFeeSar);
        Assert.Equal(0m, inspector.CourtVisitFeeSar);
    }

    [Fact]
    public void Only_a_non_flat_engineering_survey_table_uses_area_tiers()
    {
        Assert.True(PartyFeePricingRules.UsesAreaTiers(
            Table(PartyFeePricingCategories.EngineeringSurvey, PartyFeePricingKinds.Tiered)));
        Assert.False(PartyFeePricingRules.UsesAreaTiers(Table()));
        Assert.False(PartyFeePricingRules.UsesAreaTiers(
            Table(PartyFeePricingCategories.EngineeringSurvey, PartyFeePricingKinds.Flat)));
    }

    [Fact]
    public void In_memory_rate_apply_clears_tiers_for_a_flat_table()
    {
        var table = Table(PartyFeePricingCategories.FieldInspector, PartyFeePricingKinds.Flat);
        table.AreaTiers.Add(new PartyFeePricingTier { SortOrder = 0, FeeSar = 1m });

        PartyFeePricingRules.ApplyRatesInMemory(table, new PartyFeePricingDto { FlatAmountSar = 90m });

        Assert.Equal(90m, table.FlatAmountSar);
        Assert.Empty(table.AreaTiers);
    }

    [Fact]
    public void Tier_rows_are_renumbered_and_bound_to_the_table()
    {
        var tableId = Guid.NewGuid();
        var rows = PartyFeePricingRules.BuildTierRows(tableId, [
            new EngineeringSurveyFeeRules.AreaFeeTier(500m, 300m),
            new EngineeringSurveyFeeRules.AreaFeeTier(null, 900m),
        ]);

        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.Equal(tableId, r.TableId));
        Assert.Equal([0, 1], rows.Select(r => r.SortOrder));
    }

    [Fact]
    public void Stored_tiers_are_read_back_in_sort_order()
    {
        var read = PartyFeePricingRules.ReadTiers([
            new PartyFeePricingTier { SortOrder = 1, MaxAreaM2 = null, FeeSar = 900m },
            new PartyFeePricingTier { SortOrder = 0, MaxAreaM2 = 500m, FeeSar = 300m },
        ]);

        Assert.Equal([300m, 900m], read.Select(t => t.FeeSar));
        Assert.Empty(PartyFeePricingRules.ReadTiers(null));
    }

    // ---- table resolution ----

    [Theory]
    [InlineData(InspectorFeeRules.TypeEmployee, WorkflowTaskKind.FieldInspection, true)]
    [InlineData(InspectorFeeRules.TypeEmployee, WorkflowTaskKind.GovernmentReview, true)]
    [InlineData(InspectorFeeRules.TypeEmployee, WorkflowTaskKind.EngineeringSurvey, false)]
    [InlineData(InspectorFeeRules.TypeCooperatorIndividual, WorkflowTaskKind.FieldInspection, false)]
    public void Employee_incentives_only_come_from_a_flat_table(
        string partyType,
        WorkflowTaskKind taskKind,
        bool expected)
    {
        Assert.Equal(
            expected,
            PartyFeePricingRules.UsesEmployeeIncentiveTable(partyType, taskKind));
    }

    [Fact]
    public void An_incentive_table_is_usable_only_when_flat_and_priced()
    {
        Assert.False(PartyFeePricingRules.IsUsableEmployeeIncentiveTable(null));
        Assert.False(PartyFeePricingRules.IsUsableEmployeeIncentiveTable(Table()));
        Assert.False(PartyFeePricingRules.IsUsableEmployeeIncentiveTable(
            Table(PartyFeePricingCategories.FieldInspector, PartyFeePricingKinds.Flat)));
        Assert.True(PartyFeePricingRules.IsUsableEmployeeIncentiveTable(
            Table(PartyFeePricingCategories.FieldInspector, PartyFeePricingKinds.Flat, 300m)));
    }

    [Fact]
    public void Engineering_survey_never_falls_back_to_the_category_default()
    {
        Assert.False(PartyFeePricingRules.AllowsCategoryDefaultFallback(
            PartyFeePricingCategories.EngineeringSurvey));
        Assert.True(PartyFeePricingRules.AllowsCategoryDefaultFallback(
            PartyFeePricingCategories.FieldInspector));
    }

    [Fact]
    public void A_table_that_priced_nothing_is_not_recorded_as_the_source()
    {
        var tableId = Guid.NewGuid();
        Assert.Equal(ResolvedPartyFee.Unresolved, PartyFeePricingRules.ResolvedOrUnresolved(null, tableId));
        Assert.Equal(ResolvedPartyFee.Unresolved, PartyFeePricingRules.ResolvedOrUnresolved(0m, tableId));

        var resolved = PartyFeePricingRules.ResolvedOrUnresolved(250m, tableId);
        Assert.Equal(250m, resolved.FeeSar);
        Assert.Equal(tableId, resolved.PricingTableId);
    }

    [Fact]
    public void To_dto_renumbers_tiers_and_reports_the_assignee_count()
    {
        var table = Table(PartyFeePricingCategories.EngineeringSurvey, PartyFeePricingKinds.Tiered);
        table.AreaTiers.Add(new PartyFeePricingTier { SortOrder = 3, MaxAreaM2 = 500m, FeeSar = 300m });
        table.AreaTiers.Add(new PartyFeePricingTier { SortOrder = 7, MaxAreaM2 = null, FeeSar = 900m });

        var dto = PartyFeePricingRules.ToDto(table, ["a", "b"]);

        Assert.Equal(table.Id, dto.Id);
        Assert.Equal(2, dto.AssignedCount);
        Assert.Equal(["a", "b"], dto.AssignedAssigneeIds);
        Assert.Equal([0, 1], dto.AreaTiers.Select(t => t.SortOrder));
    }

    [Fact]
    public void To_dto_leaves_an_unpriced_table_visibly_empty()
    {
        var dto = PartyFeePricingRules.ToDto(
            Table(PartyFeePricingCategories.EngineeringSurvey, PartyFeePricingKinds.Tiered),
            []);

        Assert.Empty(dto.AreaTiers);
        Assert.Equal(0, dto.AssignedCount);
    }
}
