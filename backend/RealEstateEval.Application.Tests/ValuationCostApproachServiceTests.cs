using System.Reflection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Cost-approach save/read over the real repository (in-memory store): deliberate zeros and age
/// rationales persist, absurd and malformed payloads are 400s (never 500s), repeated floors need
/// a count, and the land follows the land table without a cost save.
/// </summary>
public class ValuationCostApproachServiceTests
{
    [Fact]
    public async Task Deliberate_zero_indirect_and_financing_and_age_rationales_survive_a_reload()
    {
        await using var contexts = TestDatabases.Create("cost-zeros");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);

        var (saved, errors) = await service.SaveAsync(requestId, new SaveValuationCostApproachRequest
        {
            Lines = [Line(itemKey: CostLineItemKeys.GroundFloor, area: 200m, unitCost: 1500m)],
            IndirectItems = IndirectCostItemKeys.All
                .Select((key, i) => new SaveValuationIndirectCostItemRequest { ItemKey = key, Pct = 0m, SortOrder = i })
                .ToList(),
            FinancingAnnualRatePct = 0m,
            FinancingMonths = 0,
            ActualAgeYears = 15m,
            ActualAgeRationale = " رخصة البناء 1432هـ ",
            EconomicAgeYears = 40m,
            EconomicAgeRationale = "مبنى خرساني",
        });

        Assert.Null(errors);
        Assert.NotNull(saved);
        var reloaded = await service.GetAsync(requestId);
        Assert.NotNull(reloaded);
        Assert.True(reloaded.IsSaved);
        Assert.Equal(IndirectCostItemKeys.All.Length, reloaded.IndirectItems.Count);
        Assert.All(reloaded.IndirectItems, i => Assert.Equal(0m, i.Pct));
        Assert.Equal(0m, reloaded.FinancingAnnualRatePct);
        Assert.Equal(0, reloaded.FinancingMonths);
        Assert.Equal("رخصة البناء 1432هـ", reloaded.ActualAgeRationale);
        Assert.Equal("مبنى خرساني", reloaded.EconomicAgeRationale);
    }

    [Fact]
    public async Task A_never_saved_cost_approach_reports_not_saved()
    {
        await using var contexts = TestDatabases.Create("cost-unsaved");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);

        var dto = await service.GetAsync(requestId);

        Assert.NotNull(dto);
        Assert.False(dto.IsSaved);
    }

    [Theory]
    [InlineData(1e15, 1000, "lines[0].areaSqm")]
    [InlineData(100, 1e15, "lines[0].unitCostSar")]
    public async Task Absurd_line_values_are_refused_in_arabic_and_reads_keep_working(
        double area,
        double unitCost,
        string key)
    {
        await using var contexts = TestDatabases.Create("cost-huge");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);

        var (_, errors) = await service.SaveAsync(requestId, Request([Line(itemKey: CostLineItemKeys.GroundFloor, area: (decimal)area, unitCost: (decimal)unitCost)]));

        Assert.NotNull(errors);
        Assert.Contains("الحد المعقول", errors[key]);
        Assert.NotNull(await service.GetAsync(requestId));
    }

    [Fact]
    public async Task A_legacy_out_of_range_row_still_reads_without_overflow()
    {
        await using var contexts = TestDatabases.Create("cost-legacy-huge");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);
        var costId = Guid.NewGuid();
        contexts.Valuation.ValuationCostApproaches.Add(new ValuationCostApproach
        {
            Id = costId,
            ValuationRequestId = requestId,
            Lines =
            [
                new ValuationCostLine
                {
                    Id = Guid.NewGuid(), CostApproachId = costId, ItemKey = CostLineItemKeys.GroundFloor,
                    Label = "أرضي", AreaSqm = 1e15m, UnitCostSar = 1e15m,
                },
            ],
        });
        await contexts.Valuation.SaveChangesAsync();

        var dto = await service.GetAsync(requestId);

        Assert.NotNull(dto);
        Assert.Equal(
            CostApproachRules.MaxLineQuantity * CostApproachRules.MaxUnitCostSar,
            dto.DirectCostTotal);
    }

    [Fact]
    public async Task Duplicate_line_ids_in_one_request_are_a_field_error()
    {
        await using var contexts = TestDatabases.Create("cost-dup");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);
        var id = Guid.NewGuid();

        var (_, errors) = await service.SaveAsync(requestId, Request([
                Line(id: id, itemKey: CostLineItemKeys.GroundFloor),
                Line(id: id, itemKey: CostLineItemKeys.UpperAnnex),
            ]));

        Assert.NotNull(errors);
        Assert.Contains("مكرر", errors["lines[1].id"]);
    }

    [Fact]
    public async Task A_line_id_of_another_valuation_is_refused_and_that_valuation_is_untouched()
    {
        await using var contexts = TestDatabases.Create("cost-foreign");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);
        var (_, otherRequestId) = await NewServiceAsync(contexts.Valuation);
        var foreignLineId = Guid.NewGuid();
        var (_, seedErrors) = await service.SaveAsync(otherRequestId, Request([Line(id: foreignLineId, itemKey: CostLineItemKeys.GroundFloor, area: 200m, unitCost: 1500m)]));
        Assert.Null(seedErrors);

        var (_, errors) = await service.SaveAsync(requestId, Request([Line(id: foreignLineId, itemKey: CostLineItemKeys.GroundFloor, area: 999m, unitCost: 1m)]));

        Assert.NotNull(errors);
        Assert.Contains("تقييمًا آخر", errors["lines[0].id"]);
        var other = await service.GetAsync(otherRequestId);
        var line = Assert.Single(other!.Lines);
        Assert.Equal(200m, line.AreaSqm);
        Assert.Equal(300_000m, other.DirectCostTotal);
    }

    [Fact]
    public async Task Repeated_floors_without_a_count_are_refused_instead_of_priced_at_zero()
    {
        await using var contexts = TestDatabases.Create("cost-repeated");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);

        var (_, errors) = await service.SaveAsync(requestId, Request([
                Line(itemKey: CostLineItemKeys.FirstFloor, area: 600m, unitCost: 2000m),
                Line(itemKey: CostLineItemKeys.RepeatedFloors, area: 600m, unitCost: 2000m, repeatedCount: null),
            ]));

        Assert.NotNull(errors);
        Assert.Contains("عدد الأدوار المتكررة", errors["lines[1].repeatedFloorCount"]);

        var (saved, okErrors) = await service.SaveAsync(requestId, Request([
                Line(itemKey: CostLineItemKeys.FirstFloor, area: 600m, unitCost: 2000m),
                Line(itemKey: CostLineItemKeys.RepeatedFloors, area: 0m, unitCost: 2000m, repeatedCount: 1),
            ]));
        Assert.Null(okErrors);
        Assert.Equal(2_400_000m, saved!.DirectCostTotal);
    }

    [Fact]
    public async Task Land_value_follows_the_adopted_land_comps_without_a_cost_save()
    {
        await using var contexts = TestDatabases.Create("cost-live-land");
        var land = new LandTable();
        var (service, requestId) = await NewServiceAsync(contexts.Valuation, land);
        await service.SaveAsync(requestId, Request());
        Assert.False((await service.GetAsync(requestId))!.LandEstimateComplete);

        // Adopt two whole-property land comps: 1,000/m² (600 m²) and 2,000/m² (500 m²), 50/50.
        land.List = new ValuationComparableSelectionListDto
        {
            AdoptedCount = 2,
            SubjectAreaSqm = 400m,
            AdjustmentBasis = MarketAdjustmentBasisKeys.WholeProperty,
            Items =
            [
                Adopted(600_000m, 600m, 50m),
                Adopted(1_000_000m, 500m, 50m),
            ],
        };

        var dto = await service.GetAsync(requestId);

        Assert.True(dto!.LandEstimateComplete);
        Assert.Equal(1500m, dto.LandUnitRateFromMarket);
        Assert.Equal(400m, dto.LandAreaSqm);
        Assert.Equal(600_000m, dto.LandValueFromMarket);
    }

    [Fact]
    public void Lease_cap_applies_to_any_leasehold_interest_with_a_term()
    {
        Assert.Equal(10m, CostLeaseTerms.ForInterest(isLeasehold: true, remainingLeaseYears: 10m));
        Assert.Null(CostLeaseTerms.ForInterest(isLeasehold: false, remainingLeaseYears: 10m));
        Assert.Null(CostLeaseTerms.ForInterest(isLeasehold: true, remainingLeaseYears: null));
        // Economic life 40, actual 15 → remaining 25 capped at 10 lease years → life 25.
        Assert.Equal(25m, CostApproachRules.LifeCappedByLease(40m, 15m, 10m));
        Assert.Equal(40m, CostApproachRules.LifeCappedByLease(40m, 15m, null));
        Assert.Equal(40m, CostApproachRules.LifeCappedByLease(40m, 15m, 50m));
        Assert.Equal(60m, CostApproachRules.PhysicalObsolescencePct(15m, 25m));
    }

    [Fact]
    public async Task Building_only_on_leased_land_measures_depreciation_against_the_lease()
    {
        await using var contexts = TestDatabases.Create("cost-lease");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);
        contexts.Valuation.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = requestId,
            CostApproachEnabled = true,
            CostScopeKey = CostScopeKeys.BuildingOnly,
            OwnershipInterestKey = OwnershipInterestKeys.LeasedLand,
            RemainingLeaseYears = 10m,
        });
        await contexts.Valuation.SaveChangesAsync();
        var request = Request();
        var (saved, errors) = await service.SaveAsync(requestId, new SaveValuationCostApproachRequest
        {
            Lines = request.Lines,
            ActualAgeYears = 15m,
            EconomicAgeYears = 40m,
        });

        Assert.Null(errors);
        Assert.Equal(10m, saved!.RemainingLeaseYears);
        Assert.True(saved.LifeCappedByLease);
        Assert.Equal(40m, saved.ExtendedLifeYears);
        Assert.Equal(25m, saved.EffectiveLifeYears);
        Assert.Equal(60m, saved.PhysicalObsolescencePct);

        // Freehold: the same inputs keep the full life.
        Assert.Null(CostLeaseTerms.RemainingLeaseYears(
            new ValuationApproachSettings { OwnershipInterestKey = OwnershipInterestKeys.Freehold, RemainingLeaseYears = 10m }));
        // Round 2: the cap holds whatever the scope — land with buildings included.
        Assert.Equal(10m, CostLeaseTerms.RemainingLeaseYears(
            new ValuationApproachSettings { OwnershipInterestKey = OwnershipInterestKeys.LeasedLand, RemainingLeaseYears = 10m, CostScopeKey = CostScopeKeys.LandAndBuilding }));
    }

    [Theory]
    [InlineData("usufruct", 2)]
    [InlineData("leased_land", 4)]
    public async Task A_usufruct_or_leased_land_with_its_land_valued_too_is_depreciated_over_the_lease(
        string interest, int leaseYears)
    {
        await using var contexts = TestDatabases.Create("cost-lease-scope");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation);
        contexts.Valuation.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = requestId,
            CostApproachEnabled = true,
            CostScopeKey = CostScopeKeys.LandAndBuilding,
            OwnershipInterestKey = interest,
            RemainingLeaseYears = leaseYears,
        });
        await contexts.Valuation.SaveChangesAsync();
        var (saved, errors) = await service.SaveAsync(requestId, new SaveValuationCostApproachRequest
        {
            Lines = Request().Lines,
            ActualAgeYears = 10m,
            EconomicAgeYears = 40m,
        });

        Assert.Null(errors);
        Assert.True(saved!.LifeCappedByLease);
        Assert.Equal(10m + leaseYears, saved.EffectiveLifeYears);
    }

    [Fact]
    public void High_obsolescence_threshold_is_above_90_percent()
    {
        Assert.False(CostApproachRules.ObsolescenceNeedsAlert(90m));
        Assert.True(CostApproachRules.ObsolescenceNeedsAlert(90.01m));
    }

    // ─── helpers ───

    private static SaveValuationCostApproachRequest Request(
        IReadOnlyList<SaveValuationCostLineRequest>? lines = null) => new()
    {
        Lines = lines ?? [Line(itemKey: CostLineItemKeys.GroundFloor, area: 200m, unitCost: 1500m)],
        RefreshLandFromLandComps = true,
    };

    private static SaveValuationCostLineRequest Line(
        Guid? id = null,
        string itemKey = CostLineItemKeys.Custom,
        decimal area = 100m,
        decimal unitCost = 1000m,
        int? repeatedCount = null) => new()
    {
        Id = id,
        StructureKind = BuildingStructureKinds.Floor,
        ItemKey = itemKey,
        Label = CostLineItemKeys.LabelAr(itemKey),
        AreaSqm = area,
        Unit = CostLineUnits.Sqm,
        UnitCostSar = unitCost,
        RepeatedFloorCount = repeatedCount,
    };

    private static ValuationComparableSelectionDto Adopted(decimal adjustedTotal, decimal area, decimal weight) => new()
    {
        Id = Guid.NewGuid(),
        IsAdopted = true,
        EffectiveAreaSqm = area,
        Market = new ValuationComparableMarketDto
        {
            PricePerSqmAfterDifference = adjustedTotal,
            EffectiveWeightPct = weight,
        },
    };

    private static async Task<(ValuationCostApproachService Service, Guid RequestId)> NewServiceAsync(
        ValuationDbContext db,
        LandTable? land = null)
    {
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, $"VR-C-{id:N}"[..12], Guid.NewGuid(), "جدة", "فيلا", "مقيم", "2026-06-25", DateTime.UtcNow));
        await db.SaveChangesAsync();
        var service = new ValuationCostApproachService(
            new ValuationCostApproachRepository(db),
            new ValuationReportFreezeGate(db),
            NullProxy<ICaseStudyLookup>.Create(),
            SelectionsProxy.Create(land ?? new LandTable()));
        return (service, id);
    }

    /// <summary>The land_within_cost table the selections proxy answers with (mutable per test).</summary>
    private sealed class LandTable
    {
        public ValuationComparableSelectionListDto? List { get; set; }
    }

    /// <summary>Answers every Task&lt;T&gt; call with default(T) — the case-study lookup is not under test.</summary>
    private class NullProxy<T> : DispatchProxy where T : class
    {
        public static T Create() => DispatchProxy.Create<T, NullProxy<T>>();

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            var type = targetMethod?.ReturnType;
            if (type is { IsGenericType: true } && type.GetGenericTypeDefinition() == typeof(Task<>))
            {
                var inner = type.GetGenericArguments()[0];
                var value = inner.IsValueType ? Activator.CreateInstance(inner) : null;
                return typeof(Task).GetMethod(nameof(Task.FromResult))!
                    .MakeGenericMethod(inner)
                    .Invoke(null, [value]);
            }
            return Task.CompletedTask;
        }
    }

    /// <summary>Only the land_within_cost list is read by the cost approach.</summary>
    private class SelectionsProxy : DispatchProxy
    {
        private LandTable _land = new();

        public static IValuationComparableSelectionService Create(LandTable land)
        {
            var proxy = DispatchProxy.Create<IValuationComparableSelectionService, SelectionsProxy>();
            ((SelectionsProxy)(object)proxy)._land = land;
            return proxy;
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(IValuationComparableSelectionService.ListAsync)
                && args is { Length: 3 }
                && args[1] is string context
                && context == ComparableSelectionContexts.LandWithinCost)
                return Task.FromResult(_land.List);
            throw new NotImplementedException(targetMethod?.Name);
        }
    }
}
