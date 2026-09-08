using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Application.Tests;

public class CourtCatalogRulesTests
{
    private static Court Court(
        string name = "محكمة التنفيذ بالرياض",
        string region = "الرياض",
        string city = "الرياض",
        bool isActive = true) => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Region = region,
            City = city,
            IsActive = isActive,
            CreatedBy = "actor-1",
            CreatedAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };

    private static CourtCircuit Circuit(
        string circuitNo = "1",
        string? circuitName = "دائرة التنفيذ الأولى",
        bool isActive = true) => new()
        {
            Id = Guid.NewGuid(),
            CourtId = Guid.NewGuid(),
            CircuitNo = circuitNo,
            CircuitName = circuitName,
            IsActive = isActive,
            CreatedBy = "actor-1",
            CreatedAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };

    // ---- validation ----

    [Theory]
    [InlineData("م", "الرياض", "الرياض", "اسم المحكمة مطلوب")]
    [InlineData("محكمة", " ", "الرياض", "المنطقة غير صحيحة")]
    [InlineData("محكمة", "الرياض", "", "المدينة غير صحيحة")]
    [InlineData("محكمة", "الرياض", "الرياض", null)]
    public void ValidateCourt_reports_the_first_failing_field(
        string name, string region, string city, string? expected)
    {
        Assert.Equal(expected, CourtCatalogRules.ValidateCourt(name, region, city));
    }

    [Fact]
    public void ValidateCourt_rejects_names_over_150_characters()
    {
        Assert.Equal("اسم المحكمة مطلوب", CourtCatalogRules.ValidateCourt(new string('م', 151), "الرياض", "الرياض"));
        Assert.Null(CourtCatalogRules.ValidateCourt(new string('م', 150), "الرياض", "الرياض"));
    }

    [Theory]
    [InlineData("", "رقم الدائرة مطلوب")]
    [InlineData("1", null)]
    public void ValidateCircuitNo_requires_one_to_fifty_characters(string circuitNo, string? expected)
    {
        Assert.Equal(expected, CourtCatalogRules.ValidateCircuitNo(circuitNo));
        Assert.Equal("رقم الدائرة مطلوب", CourtCatalogRules.ValidateCircuitNo(new string('1', 51)));
    }

    [Fact]
    public void NormalizeCircuitName_blank_becomes_null_and_text_is_trimmed()
    {
        Assert.Null(CourtCatalogRules.NormalizeCircuitName(null));
        Assert.Null(CourtCatalogRules.NormalizeCircuitName("   "));
        Assert.Equal("الدائرة", CourtCatalogRules.NormalizeCircuitName("  الدائرة "));
    }

    // ---- audit diffs ----

    [Fact]
    public void CourtCreated_snapshots_every_field_with_no_before_value()
    {
        var court = Court();

        var changes = CourtCatalogRules.CourtCreated(court);

        Assert.Equal(new[] { "name", "region", "city", "isActive" }, changes.Keys);
        Assert.Null(changes["name"].Before);
        Assert.Equal(court.Name, changes["name"].After);
        Assert.True(changes["isActive"].After is true);
    }

    [Fact]
    public void CourtUpdated_lists_only_the_fields_that_changed()
    {
        var court = Court(name: "محكمة التنفيذ بجدة", isActive: false);

        var changes = CourtCatalogRules.CourtUpdated(("محكمة التنفيذ بالرياض", "الرياض", "الرياض", true), court);

        Assert.Equal(new[] { "name", "isActive" }, changes.Keys);
        Assert.Equal("محكمة التنفيذ بالرياض", changes["name"].Before);
        Assert.Equal("محكمة التنفيذ بجدة", changes["name"].After);
        Assert.True(changes["isActive"].Before is true);
        Assert.True(changes["isActive"].After is false);
    }

    [Fact]
    public void CourtUpdated_is_empty_when_nothing_changed()
    {
        var court = Court();

        var changes = CourtCatalogRules.CourtUpdated((court.Name, court.Region, court.City, court.IsActive), court);

        Assert.Empty(changes);
    }

    [Fact]
    public void CircuitCreated_includes_the_owning_court()
    {
        var circuit = Circuit(circuitName: null);

        var changes = CourtCatalogRules.CircuitCreated(circuit);

        Assert.Equal(new[] { "courtId", "circuitNo", "circuitName", "isActive" }, changes.Keys);
        Assert.Equal(circuit.CourtId, changes["courtId"].After);
        Assert.Null(changes["circuitName"].After);
    }

    [Fact]
    public void CircuitUpdated_treats_a_cleared_name_as_a_change()
    {
        var circuit = Circuit(circuitNo: "2", circuitName: null);

        var changes = CourtCatalogRules.CircuitUpdated(("1", "دائرة التنفيذ الأولى", true), circuit);

        Assert.Equal(new[] { "circuitNo", "circuitName" }, changes.Keys);
        Assert.Equal("دائرة التنفيذ الأولى", changes["circuitName"].Before);
        Assert.Null(changes["circuitName"].After);
    }

    [Fact]
    public void StatusChanged_is_a_single_isActive_entry()
    {
        var changes = CourtCatalogRules.StatusChanged(true, false);

        var entry = Assert.Single(changes);
        Assert.Equal("isActive", entry.Key);
        Assert.True(entry.Value.Before is true);
        Assert.True(entry.Value.After is false);
    }

    // ---- seed catalog ----

    [Fact]
    public void Seed_ships_fourteen_courts_and_thirty_five_circuit_names()
    {
        Assert.Equal(14, CourtCatalogSeed.ExecutionCourts.Count);
        Assert.Equal(35, CourtCatalogSeed.ExecutionCircuitNames.Count);
        Assert.Equal(14, CourtCatalogSeed.ExecutionCourts.Select(c => c.Name).Distinct().Count());
        Assert.All(CourtCatalogSeed.ExecutionCourts, c => Assert.StartsWith("محكمة التنفيذ ب", c.Name));
    }

    [Fact]
    public void Seed_numbers_circuits_from_one_and_maps_the_legacy_name()
    {
        Assert.Equal("1", CourtCatalogSeed.CircuitNo(0));
        Assert.Equal("35", CourtCatalogSeed.CircuitNo(34));
        Assert.Equal("الدائرة الأولى", CourtCatalogSeed.LegacyCircuitNo("دائرة التنفيذ الأولى"));
        Assert.Equal("الدائرة الخامسة والثلاثون", CourtCatalogSeed.LegacyCircuitNo(CourtCatalogSeed.ExecutionCircuitNames[34]));
    }
}
