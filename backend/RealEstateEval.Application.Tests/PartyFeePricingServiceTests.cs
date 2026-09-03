using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Financial.Application.Services;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The pricing service decides how much every party is owed, and it had no tests at all. These cover
/// the three things that can misbill silently: which table is chosen for an assignee, how assignments
/// move between tables, and the refusal to invent an amount when nobody set one.
/// </summary>
public class PartyFeePricingServiceTests
{
    private const decimal GovernmentRate = 350m;
    private const decimal OrganizationRate = 500m;

 // ── Classification ──────────────────────────────────── ─────────────────────────────────────

 /// <summary>
 /// An unknown category used to be coerced to engineering-survey, so a typo in the filter returned
 /// another category's tables as though they were the ones asked for.
 /// </summary>
    [Theory]
    [InlineData("engineering_survey")]
    [InlineData("inspector")]
    [InlineData("")]
    public async Task An_unknown_category_is_refused_rather_than_coerced(string category)
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);

 // A blank filter means "every category", so only the create path rejects it.
        if (category.Length > 0)
        {
            await Assert.ThrowsAsync<ArgumentException>(() => service.ListAsync(category));
        }

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.CreateAsync(new CreatePartyFeePricingTableRequest
            {
                Category = category,
                Name = "جدول",
            }));
    }

 // ── Copy ───────────────────────────────────── ──────────────────────────────────────

 /// <summary>
 /// An explicit copy that cannot be honoured must fail. It used to fall through to whichever table
 /// the category happened to have, handing the new table rates nobody asked for.
 /// </summary>
    [Fact]
    public async Task Copying_from_a_table_that_does_not_exist_is_refused()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateAsync(new CreatePartyFeePricingTableRequest
            {
                Category = PartyFeePricingCategories.CourtVisit,
                Name = "جدول",
                CopyFromTableId = Guid.NewGuid(),
            }));

        Assert.Contains("غير موجود", error.Message);
    }

 /// <summary>
 /// Categories price different things — area tiers against flat amounts — so carrying one over to
 /// the other produces a table whose numbers mean nothing.
 /// </summary>
    [Fact]
    public async Task Copying_across_categories_is_refused()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await service.ListAsync();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateAsync(new CreatePartyFeePricingTableRequest
            {
                Category = PartyFeePricingCategories.FieldInspector,
                Name = "جدول",
                CopyFromTableId = PartyFeePricingService.DefaultCourtVisitTableId,
            }));

        Assert.Contains("تصنيف", error.Message);
    }

    [Fact]
    public async Task Copying_from_a_flat_table_is_refused()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        var flat = await service.CreateAsync(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "حافز",
            PricingKind = PartyFeePricingKinds.Flat,
            FlatAmountSar = 200m,
        });

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateAsync(new CreatePartyFeePricingTableRequest
            {
                Category = PartyFeePricingCategories.FieldInspector,
                Name = "نسخة",
                CopyFromTableId = flat.Id,
            }));

        Assert.Contains("حوافز", error.Message);
    }

    [Fact]
    public async Task Copying_inside_the_category_carries_the_rates_over()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        var source = await SetGovernmentRateAsync(service, GovernmentRate);

        var copy = await service.CreateAsync(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.CourtVisit,
            Name = "نسخة",
            CopyFromTableId = source.Id,
        });

        Assert.Equal(GovernmentRate, copy.CourtVisitFeeSar);
        Assert.False(copy.IsActive);
    }

 // ── Prevent precaution ────────────────────────────────── ──────────────────────────────────

 /// <summary>
 /// Every category is given a placeholder table so the pricing screen has something to edit. It
 /// must arrive empty: a placeholder that carries amounts is a rate nobody agreed to.
 /// </summary>
    [Fact]
    public async Task The_placeholder_each_category_starts_with_carries_no_amounts()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);

        await service.ListAsync();

        var tables = await db.PartyFeePricingTables.Include(t => t.AreaTiers).ToListAsync();
        Assert.Equal(PartyFeePricingCategories.All.Length, tables.Count);
        Assert.All(tables, table =>
        {
            Assert.Equal(0m, table.CourtVisitFeeSar);
            Assert.Equal(0m, table.FieldInspectorIndividualFeeSar);
            Assert.Equal(0m, table.FieldInspectorOrganizationFeeSar);
            Assert.Empty(table.AreaTiers);
        });
    }

    [Fact]
    public async Task A_new_table_with_nothing_to_copy_starts_unpriced()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);

        var created = await service.CreateAsync(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "جدول جديد",
        });

        Assert.Equal(0m, created.FieldInspectorIndividualFeeSar);
        Assert.Equal(0m, created.FieldInspectorOrganizationFeeSar);
        Assert.Empty(created.AreaTiers);
    }

 /// <summary>
 /// Zero is "nobody set a rate", not "the rate is zero", so it must resolve to nothing and let the
 /// caller refuse to bill rather than write a zero-value line.
 /// </summary>
    [Theory]
    [InlineData(WorkflowTaskKind.GovernmentReview, InspectorFeeRules.TypeCooperatorIndividual, null)]
    [InlineData(WorkflowTaskKind.FieldInspection, InspectorFeeRules.TypeCooperatorOrganization, null)]
    [InlineData(WorkflowTaskKind.FieldInspection, InspectorFeeRules.TypeCooperatorIndividual, null)]
    [InlineData(WorkflowTaskKind.EngineeringSurvey, InspectorFeeRules.TypeCooperatorOrganization, 300)]
    public async Task An_unpriced_table_resolves_to_no_fee(
        WorkflowTaskKind kind,
        string partyType,
        int? areaM2)
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);

        var fee = await service.ResolveDefaultFeeAsync(kind, partyType, areaM2);

        Assert.Null(fee.FeeSar);
        Assert.Null(fee.PricingTableId);
    }

 /// <summary>
 /// An employee's fee is agreed case by case and entered by hand, so the table must not answer for
 /// them even once it is priced.
 /// </summary>
    [Fact]
    public async Task An_employee_inspector_is_never_priced_from_the_table()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await SetInspectorRatesAsync(service, individual: 400m, organization: OrganizationRate);

        var fee = await service.ResolveDefaultFeeAsync(
            WorkflowTaskKind.FieldInspection,
            InspectorFeeRules.TypeEmployee);

        Assert.Null(fee.FeeSar);
    }

    [Fact]
    public async Task A_rate_that_was_actually_set_resolves()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await SetGovernmentRateAsync(service, GovernmentRate);
        await SetInspectorRatesAsync(service, individual: 400m, organization: OrganizationRate);

        Assert.Equal(
            GovernmentRate,
            (await service.ResolveDefaultFeeAsync(
                WorkflowTaskKind.GovernmentReview,
                InspectorFeeRules.TypeCooperatorIndividual)).FeeSar);
        Assert.Equal(
            OrganizationRate,
            (await service.ResolveDefaultFeeAsync(
                WorkflowTaskKind.FieldInspection,
                InspectorFeeRules.TypeCooperatorOrganization)).FeeSar);
    }

 /// <summary>
 /// The amount is useless as evidence without the schedule behind it, so resolution names the
 /// table it read — and names nothing when it read no rate.
 /// </summary>
    [Fact]
    public async Task A_resolved_fee_names_the_table_it_came_from()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await SetGovernmentRateAsync(service, GovernmentRate);

        var fee = await service.ResolveDefaultFeeAsync(
            WorkflowTaskKind.GovernmentReview,
            InspectorFeeRules.TypeCooperatorIndividual);

        Assert.Equal(GovernmentRate, fee.FeeSar);
        Assert.Equal(PartyFeePricingService.DefaultCourtVisitTableId, fee.PricingTableId);
    }

    [Fact]
    public async Task Saving_an_engineering_table_with_no_tiers_is_refused()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        var table = await service.GetActiveAsync();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SaveAsync(table.Id, new PartyFeePricingDto
            {
                Id = table.Id,
                Name = table.Name,
                AreaTiers = [],
            }));

        Assert.Contains("شريحة", error.Message);
    }

    [Fact]
    public async Task Engineering_tiers_replace_the_previous_schedule_and_price_by_area()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        var table = await service.GetActiveAsync();
        await SaveTiersAsync(service, table.Id, (500m, 800m), (null, 1500m));

        await SaveTiersAsync(service, table.Id, (400m, 900m), (null, 1600m));

        Assert.Equal(2, await db.PartyFeePricingTiers.CountAsync(t => t.TableId == table.Id));
        Assert.Equal(
            900m,
            (await service.ResolveDefaultFeeAsync(
                WorkflowTaskKind.EngineeringSurvey,
                InspectorFeeRules.TypeCooperatorOrganization,
                areaM2: 400m)).FeeSar);
        Assert.Equal(
            1600m,
            (await service.ResolveDefaultFeeAsync(
                WorkflowTaskKind.EngineeringSurvey,
                InspectorFeeRules.TypeCooperatorOrganization,
                areaM2: 401m)).FeeSar);
    }

 // ── Table selection and reference ───────────────────────────── ─────────────────────────────

    [Fact]
    public async Task An_assigned_party_is_priced_by_their_own_table_not_the_default()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await SetGovernmentRateAsync(service, GovernmentRate);

        var special = await service.CreateAsync(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.CourtVisit,
            Name = "خاص",
        });
        await service.SaveAsync(special.Id, new PartyFeePricingDto
        {
            Id = special.Id,
            Name = special.Name,
            CourtVisitFeeSar = 700m,
        });
        await service.SetAssignmentsAsync(special.Id, ["gr-special"]);

        var assigned = await service.ResolveDefaultFeeAsync(
            WorkflowTaskKind.GovernmentReview,
            InspectorFeeRules.TypeCooperatorIndividual,
            assigneeId: "gr-special");
        Assert.Equal(700m, assigned.FeeSar);
        Assert.Equal(special.Id, assigned.PricingTableId);

        Assert.Equal(
            GovernmentRate,
            (await service.ResolveDefaultFeeAsync(
                WorkflowTaskKind.GovernmentReview,
                InspectorFeeRules.TypeCooperatorIndividual,
                assigneeId: "gr-other")).FeeSar);
    }

 /// <summary>
 /// Survey rates are negotiated per office, so an office with no table of its own has no price at
 /// all — the category default must not stand in for a contract that was never signed.
 /// </summary>
    [Fact]
    public async Task An_engineering_office_with_no_assignment_has_no_price()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        var table = await service.GetActiveAsync();
        await SaveTiersAsync(service, table.Id, (null, 1200m));

        Assert.Null((await service.ResolveDefaultFeeAsync(
            WorkflowTaskKind.EngineeringSurvey,
            InspectorFeeRules.TypeCooperatorOrganization,
            areaM2: 300m,
            assigneeId: "eo-unassigned")).FeeSar);

 // The same area is priced once the office is pointed at the table.
        await service.SetAssignmentsAsync(table.Id, ["eo-unassigned"]);
        Assert.Equal(
            1200m,
            (await service.ResolveDefaultFeeAsync(
                WorkflowTaskKind.EngineeringSurvey,
                InspectorFeeRules.TypeCooperatorOrganization,
                areaM2: 300m,
                assigneeId: "eo-unassigned")).FeeSar);
    }

    [Fact]
    public async Task Assignments_are_trimmed_and_deduplicated()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        var table = await service.GetActiveAsync();

        var saved = await service.SetAssignmentsAsync(
            table.Id,
            ["  eo-1  ", "eo-1", "EO-1", "", "   ", "eo-2"]);

        Assert.Equal(["eo-1", "eo-2"], saved.AssignedAssigneeIds);
        Assert.Equal(2, saved.AssignedCount);
    }

 /// <summary>
 /// One party cannot hold two rates for the same work, so assigning them elsewhere has to take the
 /// earlier assignment away rather than leave whichever row the resolver happens to read first.
 /// </summary>
    [Fact]
    public async Task Assigning_a_party_elsewhere_moves_them_off_their_previous_table()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        var first = await service.GetActiveAsync();
        var second = await service.CreateAsync(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.EngineeringSurvey,
            Name = "ثانٍ",
        });
        await service.SetAssignmentsAsync(first.Id, ["eo-1", "eo-2"]);

        await service.SetAssignmentsAsync(second.Id, ["eo-1"]);

        Assert.Equal(["eo-2"], await service.ListAssignmentsAsync(first.Id));
        Assert.Equal(["eo-1"], await service.ListAssignmentsAsync(second.Id));
    }

 /// <summary>
 /// An assignment is scoped to its category. A party paid survey rates from one table and
 /// inspection rates from another must keep both.
 /// </summary>
    [Fact]
    public async Task An_assignment_in_another_category_is_left_alone()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await service.ListAsync();
        await service.SetAssignmentsAsync(PartyFeePricingService.DefaultEngineeringTableId, ["p-1"]);

        await service.SetAssignmentsAsync(PartyFeePricingService.DefaultInspectorTableId, ["p-1"]);

        Assert.Equal(
            ["p-1"],
            await service.ListAssignmentsAsync(PartyFeePricingService.DefaultEngineeringTableId));
        Assert.Equal(
            ["p-1"],
            await service.ListAssignmentsAsync(PartyFeePricingService.DefaultInspectorTableId));
    }

 /// <summary>
 /// Once parties depend on a schedule, changing that row would silently rewrite the contract
 /// behind their next fee. The old schedule becomes immutable instead.
 /// </summary>
    [Fact]
    public async Task An_assigned_table_refuses_direct_rate_changes()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await SetGovernmentRateAsync(service, GovernmentRate);
        var tableId = PartyFeePricingService.DefaultCourtVisitTableId;
        await service.SetAssignmentsAsync(tableId, ["reviewer-1"]);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SaveAsync(tableId, new PartyFeePricingDto
            {
                Id = tableId,
                Name = "تعديل مباشر",
                CourtVisitFeeSar = 700m,
            }));

        Assert.Contains("نسخة جديدة", error.Message);
        var unchanged = await service.GetByIdAsync(tableId);
        Assert.Equal(GovernmentRate, unchanged!.CourtVisitFeeSar);
        Assert.Equal("افتراضي", unchanged.Name);
    }

 /// <summary>
 /// A revision is one operation: copy the rates, apply the edit, move every party, and transfer
 /// the default flag. Nobody can observe an assignment pointing at a half-written schedule.
 /// </summary>
    [Fact]
    public async Task Revising_an_assigned_table_copies_it_and_relinks_parties_atomically()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await SetGovernmentRateAsync(service, GovernmentRate);
        var sourceId = PartyFeePricingService.DefaultCourtVisitTableId;
        await service.SetAssignmentsAsync(sourceId, ["reviewer-1", "reviewer-2"]);

        var revision = await service.ReviseAsync(sourceId, new PartyFeePricingDto
        {
            Id = sourceId,
            Name = "عقد ٢٠٢٧",
            CourtVisitFeeSar = 700m,
        });

        Assert.NotEqual(sourceId, revision.Id);
        Assert.Equal(700m, revision.CourtVisitFeeSar);
        Assert.True(revision.IsActive);
        Assert.Equal(["reviewer-1", "reviewer-2"], revision.AssignedAssigneeIds);

        var source = await service.GetByIdAsync(sourceId);
        Assert.NotNull(source);
        Assert.Equal(GovernmentRate, source!.CourtVisitFeeSar);
        Assert.False(source.IsActive);
        Assert.Empty(source.AssignedAssigneeIds);
        Assert.Equal(
            revision.Id,
            (await service.ResolveDefaultFeeAsync(
                WorkflowTaskKind.GovernmentReview,
                InspectorFeeRules.TypeCooperatorIndividual,
                assigneeId: "reviewer-1")).PricingTableId);
    }

    [Fact]
    public async Task A_failed_revision_leaves_the_source_and_its_assignments_untouched()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        var source = await service.GetActiveAsync();
        await SaveTiersAsync(service, source.Id, (null, 1200m));
        await service.SetAssignmentsAsync(source.Id, ["office-1"]);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ReviseAsync(source.Id, new PartyFeePricingDto
            {
                Id = source.Id,
                Name = "نسخة غير صالحة",
                AreaTiers = [],
            }));

        var unchanged = await service.GetByIdAsync(source.Id);
        Assert.True(unchanged!.IsActive);
        Assert.Equal(["office-1"], unchanged.AssignedAssigneeIds);
        Assert.Equal(1200m, unchanged.AreaTiers.Single().FeeSar);
        Assert.Single(await service.ListAsync(PartyFeePricingCategories.EngineeringSurvey));
    }

    [Fact]
    public async Task An_assigned_table_cannot_be_deleted()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await service.ListAsync();
        var sourceId = PartyFeePricingService.DefaultCourtVisitTableId;
        await service.SetAssignmentsAsync(sourceId, ["reviewer-1"]);
        await service.CreateAsync(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.CourtVisit,
            Name = "ثانٍ",
        });

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.DeleteAsync(sourceId));

        Assert.Contains("مرتبط بأطراف", error.Message);
        Assert.NotNull(await service.GetByIdAsync(sourceId));
    }

 // ── Default and delete tables ───────────────────────────── ─────────────────────────────

    [Fact]
    public async Task Activating_a_table_demotes_the_previous_default_of_its_category_only()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await service.ListAsync();
        var second = await service.CreateAsync(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.CourtVisit,
            Name = "ثانٍ",
        });

        await service.ActivateAsync(second.Id);

        var active = await db.PartyFeePricingTables
            .Where(t => t.IsActive)
            .Select(t => new { t.Id, t.Category })
            .ToListAsync();
        Assert.Equal(PartyFeePricingCategories.All.Length, active.Count);
        Assert.Contains(active, a => a.Id == second.Id);
        Assert.DoesNotContain(active, a => a.Id == PartyFeePricingService.DefaultCourtVisitTableId);
    }

    [Fact]
    public async Task The_only_table_left_in_a_category_cannot_be_deleted()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await service.ListAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.DeleteAsync(PartyFeePricingService.DefaultCourtVisitTableId));
    }

 /// <summary>
 /// Deleting the default must hand the role to another table in the same breath, or the category is
 /// left with no rates at all and every fee in it stops resolving.
 /// </summary>
    [Fact]
    public async Task Deleting_the_default_promotes_another_table_in_its_category()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await service.ListAsync();
        var second = await service.CreateAsync(new CreatePartyFeePricingTableRequest
        {
            Category = PartyFeePricingCategories.CourtVisit,
            Name = "ثانٍ",
        });

        Assert.True(await service.DeleteAsync(PartyFeePricingService.DefaultCourtVisitTableId));

        var remaining = await db.PartyFeePricingTables
            .SingleAsync(t => t.Category == PartyFeePricingCategories.CourtVisit);
        Assert.Equal(second.Id, remaining.Id);
        Assert.True(remaining.IsActive);
    }

    [Fact]
    public async Task Deleting_a_table_that_does_not_exist_reports_it_rather_than_throwing()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);

        Assert.False(await service.DeleteAsync(Guid.NewGuid()));
    }

 // ── Aid ──────────────────────────────────── ─────────────────────────────────────

    private static async Task<PartyFeePricingDto> SetGovernmentRateAsync(
        PartyFeePricingService service,
        decimal rate)
    {
        await service.ListAsync();
        return await service.SaveAsync(
            PartyFeePricingService.DefaultCourtVisitTableId,
            new PartyFeePricingDto
            {
                Id = PartyFeePricingService.DefaultCourtVisitTableId,
                Name = "افتراضي",
                CourtVisitFeeSar = rate,
            });
    }

    private static async Task SetInspectorRatesAsync(
        PartyFeePricingService service,
        decimal individual,
        decimal organization)
    {
        await service.ListAsync();
        await service.SaveAsync(
            PartyFeePricingService.DefaultInspectorTableId,
            new PartyFeePricingDto
            {
                Id = PartyFeePricingService.DefaultInspectorTableId,
                Name = "افتراضي",
                FieldInspectorIndividualFeeSar = individual,
                FieldInspectorOrganizationFeeSar = organization,
            });
    }

    private static async Task SaveTiersAsync(
        PartyFeePricingService service,
        Guid tableId,
        params (decimal? MaxAreaM2, decimal FeeSar)[] tiers)
    {
        await service.SaveAsync(tableId, new PartyFeePricingDto
        {
            Id = tableId,
            Name = "افتراضي",
            AreaTiers = tiers
                .Select((t, i) => new PartyFeePricingTierDto
                {
                    SortOrder = i,
                    MaxAreaM2 = t.MaxAreaM2,
                    FeeSar = t.FeeSar,
                })
                .ToList(),
        });
    }

    private static FinancialDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<FinancialDbContext>()
            .UseInMemoryDatabase($"party-fee-pricing-{Guid.NewGuid():N}")
            .Options);
}
