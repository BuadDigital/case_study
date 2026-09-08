using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Application.Tests;

public class LocationCatalogRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 1, 12, 0, 0, DateTimeKind.Utc);

    private static LocationSeedRegion SeedRegion(int id, string code = "RD", bool isActive = true) =>
        new(id, code, id * 10, " الرياض ", " الرياض ", isActive);

    private static LocationSeedCity SeedCity(
        int id,
        int regionId = 1,
        string nameAr = "الرياض",
        string? nameSearch = null,
        bool isActive = true) =>
        new(id, regionId, nameAr, null, nameSearch, false, false, isActive, null);

    private static City City(
        string nameAr,
        string status = LocationCatalogStatuses.Approved,
        int? officialId = null,
        int usage = 0) => new()
        {
            Id = Guid.NewGuid(),
            OfficialId = officialId,
            RegionId = Guid.NewGuid(),
            NameAr = nameAr,
            NameSearch = LocationNameNormalizer.Normalize(nameAr),
            Status = status,
            UsageCount = usage,
            CreatedAtUtc = Now,
        };

    private static District District(string nameAr, string status = LocationCatalogStatuses.Pending, int usage = 0) =>
        new()
        {
            Id = Guid.NewGuid(),
            CityId = Guid.NewGuid(),
            NameAr = nameAr,
            NameSearch = LocationNameNormalizer.Normalize(nameAr),
            Status = status,
            UsageCount = usage,
            CreatedAtUtc = Now,
        };

    // ---- seed ids and fast path ----

    [Fact]
    public void SeedGuid_is_deterministic_and_distinct_per_kind_and_id()
    {
        Assert.Equal(LocationCatalogRules.RegionSeedGuid(7), LocationCatalogRules.RegionSeedGuid(7));
        Assert.NotEqual(LocationCatalogRules.RegionSeedGuid(7), LocationCatalogRules.CitySeedGuid(7));
        Assert.NotEqual(LocationCatalogRules.CitySeedGuid(7), LocationCatalogRules.CitySeedGuid(8));
        Assert.Equal(
            LocationCatalogRules.SeedGuid(LocationCatalogRules.CitySeedKind, 3077),
            LocationCatalogRules.CitySeedGuid(3077));
    }

    [Fact]
    public void HasUsableSeed_needs_both_regions_and_cities()
    {
        Assert.False(LocationCatalogRules.HasUsableSeed(null));
        Assert.False(LocationCatalogRules.HasUsableSeed(new LocationCatalogSeed([SeedRegion(1)], [])));
        Assert.False(LocationCatalogRules.HasUsableSeed(new LocationCatalogSeed([], [SeedCity(1)])));
        Assert.True(LocationCatalogRules.HasUsableSeed(new LocationCatalogSeed([SeedRegion(1)], [SeedCity(1)])));
    }

    [Fact]
    public void CatalogAlreadyImported_counts_only_active_shipped_cities()
    {
        var payload = new LocationCatalogSeed(
            [SeedRegion(1), SeedRegion(2, "MK")],
            [SeedCity(1), SeedCity(2), SeedCity(3, isActive: false)]);

        Assert.True(LocationCatalogRules.CatalogAlreadyImported(payload, activeRegions: 2, officialSearchableCities: 2));
        Assert.False(LocationCatalogRules.CatalogAlreadyImported(payload, activeRegions: 1, officialSearchableCities: 2));
        Assert.False(LocationCatalogRules.CatalogAlreadyImported(payload, activeRegions: 2, officialSearchableCities: 1));
    }

    [Fact]
    public void CitySearchKey_prefers_the_shipped_key_and_normalises_either()
    {
        Assert.Equal("مدينه الرياض", LocationCatalogRules.CitySearchKey(SeedCity(1, nameAr: "مدينة الرياض")));
        Assert.Equal("جده", LocationCatalogRules.CitySearchKey(SeedCity(1, nameAr: "الرياض", nameSearch: "جدة")));
    }

    [Fact]
    public void ApplySeedRegion_trims_the_official_fields()
    {
        var region = new Region { Id = Guid.NewGuid() };

        LocationCatalogRules.ApplySeedRegion(region, SeedRegion(1, code: " RD ", isActive: false));

        Assert.Equal("RD", region.Code);
        Assert.Equal(10, region.AdminAreaId);
        Assert.Equal("الرياض", region.NameAr);
        Assert.Equal("الرياض", region.CapitalAr);
        Assert.False(region.IsActive);
    }

    [Fact]
    public void ApplySeedCity_keeps_a_pending_row_pending_and_approves_the_rest()
    {
        var regionId = Guid.NewGuid();
        var pending = City("الرياض", status: LocationCatalogStatuses.Pending);
        var merged = City("الرياض", status: LocationCatalogStatuses.Merged);

        LocationCatalogRules.ApplySeedCity(pending, SeedCity(1, nameAr: " الرياض "), regionId);
        LocationCatalogRules.ApplySeedCity(merged, SeedCity(1), regionId);

        Assert.Equal(LocationCatalogStatuses.Pending, pending.Status);
        Assert.Equal(LocationCatalogStatuses.Approved, merged.Status);
        Assert.Equal(regionId, pending.RegionId);
        Assert.Equal("الرياض", pending.NameAr);
        Assert.Equal("الرياض", pending.NameSearch);
        Assert.Null(pending.NameEn);
    }

    [Fact]
    public void IsStaleSeededCity_spares_pending_rows_and_matches_by_official_id_then_seed_guid()
    {
        var touched = new HashSet<int> { 5 };
        var seedIds = new HashSet<Guid> { LocationCatalogRules.CitySeedGuid(9) };
        var legacy = City("قديمة");
        legacy.Id = LocationCatalogRules.CitySeedGuid(9);

        Assert.False(LocationCatalogRules.IsStaleSeededCity(City("معلقة", LocationCatalogStatuses.Pending), touched, seedIds));
        Assert.False(LocationCatalogRules.IsStaleSeededCity(City("رسمية", officialId: 5), touched, seedIds));
        Assert.True(LocationCatalogRules.IsStaleSeededCity(City("محذوفة", officialId: 6), touched, seedIds));
        Assert.False(LocationCatalogRules.IsStaleSeededCity(legacy, touched, seedIds));
        Assert.True(LocationCatalogRules.IsStaleSeededCity(City("يتيمة"), touched, seedIds));
    }

    // ---- suggestions ----

    [Theory]
    [InlineData(null, "city")]
    [InlineData(" District ", "district")]
    public void NormalizeKind_defaults_to_city(string? kind, string expected)
    {
        Assert.Equal(expected, LocationCatalogRules.NormalizeKind(kind));
    }

    [Fact]
    public void SimilarCities_matches_exact_and_near_names_and_caps_at_eight()
    {
        var search = LocationNameNormalizer.Normalize("الرياض");
        var cities = Enumerable.Range(0, 10).Select(_ => City("الرياض")).ToList();
        cities.Add(City("الرياضه", LocationCatalogStatuses.Pending));
        cities.Add(City("جدة"));

        var similar = LocationCatalogRules.SimilarCities(cities, search);

        Assert.Equal(LocationCatalogRules.MaxSimilar, similar.Count);
        Assert.All(similar, s => Assert.True(s.IsApproved));
        Assert.Contains(LocationCatalogRules.SimilarCities([cities[10], cities[11]], search), s => s.NameAr == "الرياضه" && !s.IsApproved);
        Assert.DoesNotContain(LocationCatalogRules.SimilarCities(cities, search), s => s.NameAr == "جدة");
    }

    [Fact]
    public void SimilarDistricts_uses_the_same_gate_and_force_create_bypasses_it()
    {
        var search = LocationNameNormalizer.Normalize("حي العليا");
        var similar = LocationCatalogRules.SimilarDistricts([District("العليا"), District("الملز")], search);

        var only = Assert.Single(similar);
        Assert.Equal("العليا", only.NameAr);
        Assert.True(LocationCatalogRules.RequiresConfirmation(similar, forceCreate: false));
        Assert.False(LocationCatalogRules.RequiresConfirmation(similar, forceCreate: true));
        Assert.False(LocationCatalogRules.RequiresConfirmation([], forceCreate: false));
    }

    // ---- review ----

    [Theory]
    [InlineData(" Approve ", true)]
    [InlineData("rename", true)]
    [InlineData("merge", false)]
    [InlineData(null, false)]
    public void Review_actions_are_normalised_before_dispatch(string? action, bool approveOrRename)
    {
        Assert.Equal(approveOrRename, LocationCatalogRules.IsApproveOrRename(LocationCatalogRules.NormalizeAction(action)));
    }

    [Fact]
    public void ResolveReviewName_keeps_the_suggested_name_when_blank_and_rejects_non_arabic()
    {
        Assert.Null(LocationCatalogRules.ResolveReviewName(null));
        Assert.Null(LocationCatalogRules.ResolveReviewName("  "));
        Assert.Equal("الرياض", LocationCatalogRules.ResolveReviewName(" الرياض "));
        var ex = Assert.Throws<InvalidOperationException>(() => LocationCatalogRules.ResolveReviewName("Riyadh"));
        Assert.Equal("الاسم يجب أن يكون بالعربية.", ex.Message);
    }

    [Fact]
    public void RequireMergeTarget_rejects_missing_and_empty_ids()
    {
        var id = Guid.NewGuid();
        Assert.Equal(id, LocationCatalogRules.RequireMergeTarget(id));
        Assert.Equal("معرّف الدمج مطلوب.", Assert.Throws<InvalidOperationException>(() => LocationCatalogRules.RequireMergeTarget(null)).Message);
        Assert.Equal("معرّف الدمج مطلوب.", Assert.Throws<InvalidOperationException>(() => LocationCatalogRules.RequireMergeTarget(Guid.Empty)).Message);
    }

    [Fact]
    public void ApproveCity_renames_and_stamps_the_reviewer()
    {
        var city = City("رياض", LocationCatalogStatuses.Pending);

        LocationCatalogRules.ApproveCity(city, "مدينة الرياض", Now, "reviewer-1");

        Assert.Equal(LocationCatalogStatuses.Approved, city.Status);
        Assert.Equal("مدينة الرياض", city.NameAr);
        Assert.Equal("مدينه الرياض", city.NameSearch);
        Assert.Equal(Now, city.ReviewedAtUtc);
        Assert.Equal("reviewer-1", city.ReviewedByUserId);
    }

    [Fact]
    public void MergeCity_moves_usage_onto_the_target_and_retires_the_row()
    {
        var city = City("رياض", LocationCatalogStatuses.Pending, usage: 3);
        var target = City("الرياض", usage: 2);

        LocationCatalogRules.MergeCity(city, target, Now, "reviewer-1");

        Assert.Equal(5, target.UsageCount);
        Assert.Equal(LocationCatalogStatuses.Merged, city.Status);
        Assert.Equal(target.Id, city.MergedIntoCityId);
        Assert.False(city.IsActive);
        Assert.Equal(Now, city.ReviewedAtUtc);
        Assert.Equal("reviewer-1", city.ReviewedByUserId);
    }

    [Fact]
    public void District_transitions_mirror_the_city_ones()
    {
        var approved = District("العليا");
        LocationCatalogRules.ApproveDistrict(approved, null, Now, "reviewer-2");
        Assert.Equal(LocationCatalogStatuses.Approved, approved.Status);
        Assert.Equal("العليا", approved.NameAr);
        Assert.Equal("reviewer-2", approved.ReviewedByUserId);

        var merged = District("العليا", usage: 4);
        var target = District("حي العليا", LocationCatalogStatuses.Approved, usage: 1);
        LocationCatalogRules.MergeDistrict(merged, target, Now, "reviewer-2");
        Assert.Equal(5, target.UsageCount);
        Assert.Equal(LocationCatalogStatuses.Merged, merged.Status);
        Assert.Equal(target.Id, merged.MergedIntoDistrictId);
        Assert.False(merged.IsActive);
    }

    // ---- lists and projections ----

    [Fact]
    public void OrderPending_puts_most_used_then_newest_first()
    {
        var rows = new List<PendingLocationDto>
        {
            new() { Id = Guid.NewGuid(), NameAr = "أ", UsageCount = 1, CreatedAtUtc = Now },
            new() { Id = Guid.NewGuid(), NameAr = "ب", UsageCount = 3, CreatedAtUtc = Now.AddDays(-1) },
            new() { Id = Guid.NewGuid(), NameAr = "ج", UsageCount = 1, CreatedAtUtc = Now.AddDays(1) },
        };

        var ordered = LocationCatalogRules.OrderPending(rows);

        Assert.Equal(new[] { "ب", "ج", "أ" }, ordered.Select(r => r.NameAr));
    }

    [Fact]
    public void ToCityDto_uses_the_loaded_region_name_or_the_supplied_one()
    {
        var city = City("الرياض", officialId: 1);
        city.Region = new Region { Id = city.RegionId, NameAr = "منطقة الرياض" };

        Assert.Equal("منطقة الرياض", LocationCatalogRules.ToCityDto(city).RegionNameAr);
        Assert.Equal("المنطقة", LocationCatalogRules.ToCityDto(city, "المنطقة").RegionNameAr);
        Assert.Equal("", LocationCatalogRules.ToCityDto(City("جدة")).RegionNameAr);

        var dto = LocationCatalogRules.ToDistrictDto(District("العليا"));
        Assert.Equal("العليا", dto.NameAr);
        Assert.Equal(LocationCatalogStatuses.Pending, dto.Status);
    }
}
