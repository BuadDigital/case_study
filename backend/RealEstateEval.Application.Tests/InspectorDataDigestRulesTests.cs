using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

public class InspectorDataDigestRulesTests
{
    private const string Base = """
        {
          "status": "draft",
          "returnNote": "",
          "submittedAtUtc": null,
          "updatedAtUtc": "2026-10-01T10:00:00Z",
          "completedOnSiteAtUtc": "2026-10-01T09:00:00Z",
          "inspectionConfirmed": false,
          "featureValues": { "assetSubject": "فيلا", "facade": "شمالية" },
          "vacantLand": false,
          "roomCount": "5",
          "builtArea": "300",
          "buildingFloors": "2",
          "propertyAgeYears": "7",
          "buildLicenseNumber": "L-1",
          "boundaryMatches": { "north": { "matches": true, "deedDesc": "شارع" }, "south": { "matches": null } },
          "deedMatchesNature": "yes",
          "mapLatitude": "21.5",
          "mapLongitude": "39.1",
          "mapPinned": true,
          "streetName": "الأمير",
          "definedPhotos": { "front": { "none": false, "photos": [ { "id": 1, "fileName": "a.jpg" } ] } },
          "propertyDescription": "وصف",
          "services": ["كهرباء", "ماء"],
          "waterMeterCount": "1"
        }
        """;

    private static IReadOnlyDictionary<string, string> Hashes(string json) =>
        InspectorDataDigestRules.Compute(json);

    private static string Mutate(string from, string to) => Base.Replace(from, to);

    private static IReadOnlyList<string> Changed(string before, string after)
    {
        var a = Hashes(before);
        var b = Hashes(after);
        return InspectorDataDigestRules.GroupKeys.Where(g => a[g] != b[g]).ToList();
    }

    [Fact]
    public void Encodes_every_group_in_a_stable_order()
    {
        var encoded = InspectorDataDigestRules.Encode(Hashes(Base));

        var groups = encoded.Split(';').Select(p => p.Split(':')[0]).ToList();
        Assert.Equal(InspectorDataDigestRules.GroupKeys, groups);
        Assert.Equal(encoded, InspectorDataDigestRules.Fingerprint(Base));
    }

    [Fact]
    public void Key_order_and_string_padding_do_not_change_any_hash()
    {
        const string reordered = """
            { "builtArea": " 300 ", "roomCount": "5", "featureValues": { "facade": "شمالية", "assetSubject": "فيلا" },
              "services": ["ماء", "كهرباء"], "waterMeterCount": "1" }
            """;
        const string original = """
            { "services": ["كهرباء", "ماء"], "featureValues": { "assetSubject": "فيلا", "facade": "شمالية" },
              "waterMeterCount": "1", "roomCount": "5", "builtArea": "300" }
            """;

        Assert.Equal(Hashes(original), Hashes(reordered));
    }

    [Fact]
    public void Volatile_keys_are_ignored()
    {
        var volatileChanged = Base
            .Replace("\"status\": \"draft\"", "\"status\": \"submitted\"")
            .Replace("\"returnNote\": \"\"", "\"returnNote\": \"أعد\"")
            .Replace("\"submittedAtUtc\": null", "\"submittedAtUtc\": \"2026-10-02T00:00:00Z\"")
            .Replace("2026-10-01T10:00:00Z", "2026-10-03T10:00:00Z")
            .Replace("2026-10-01T09:00:00Z", "2026-10-03T09:00:00Z")
            .Replace("\"inspectionConfirmed\": false", "\"inspectionConfirmed\": true")
            .Replace("\"vacantLand\": false,", "\"vacantLand\": false, \"sourceFingerprintSeen\": \"abc\", \"inspectorDataSeen\": \"x\",");

        Assert.Empty(Changed(Base, volatileChanged));
    }

    [Fact]
    public void Missing_empty_and_false_values_are_the_same()
    {
        const string sparse = """{ "builtArea": "300" }""";
        const string explicitEmpty = """
            { "builtArea": "300", "roomCount": "", "services": [], "vacantLand": false, "mapPinned": false,
              "featureValues": {}, "definedPhotos": {}, "propertyDescription": "   " }
            """;

        Assert.Equal(Hashes(sparse), Hashes(explicitEmpty));
    }

    [Theory]
    [InlineData("\"builtArea\": \"300\"", "\"builtArea\": \"310\"", "area")]
    [InlineData("\"roomCount\": \"5\"", "\"roomCount\": \"6\"", "components")]
    [InlineData("\"propertyAgeYears\": \"7\"", "\"propertyAgeYears\": \"8\"", "age")]
    [InlineData("\"mapLatitude\": \"21.5\"", "\"mapLatitude\": \"21.6\"", "location")]
    [InlineData("\"streetName\": \"الأمير\"", "\"streetName\": \"الملك\"", "location")]
    [InlineData("\"propertyDescription\": \"وصف\"", "\"propertyDescription\": \"وصف آخر\"", "narrative")]
    [InlineData("\"waterMeterCount\": \"1\"", "\"waterMeterCount\": \"2\"", "services")]
    [InlineData("\"deedMatchesNature\": \"yes\"", "\"deedMatchesNature\": \"no\"", "boundaries")]
    [InlineData("\"fileName\": \"a.jpg\"", "\"fileName\": \"b.jpg\"", "photos")]
    [InlineData("\"assetSubject\": \"فيلا\"", "\"assetSubject\": \"أرض\"", "assetType")]
    [InlineData("\"facade\": \"شمالية\"", "\"facade\": \"جنوبية\"", "narrative")]
    public void A_change_moves_only_its_own_group(string from, string to, string group)
    {
        Assert.Equal([group], Changed(Base, Mutate(from, to)));
    }

    [Fact]
    public void A_tri_state_boundary_verdict_is_kept_not_collapsed()
    {
        // south.matches: null → false is a real answer.
        var changed = Changed(Base, Mutate("\"south\": { \"matches\": null }", "\"south\": { \"matches\": false }"));

        Assert.Equal(["boundaries"], changed);
    }

    [Fact]
    public void Services_are_a_set_so_their_order_is_irrelevant_but_membership_is_not()
    {
        Assert.Empty(Changed(Base, Mutate("[\"كهرباء\", \"ماء\"]", "[\"ماء\", \"كهرباء\"]")));
        Assert.Equal(["services"], Changed(Base, Mutate("[\"كهرباء\", \"ماء\"]", "[\"كهرباء\", \"ماء\", \"صرف\"]")));
    }

    [Fact]
    public void Components_group_covers_the_inventory_lines_and_the_specialist_text_only()
    {
        var lines = new[]
        {
            new BuildingInventoryLine { SortOrder = 1, StructureKind = "floor", Label = "الأرضي", AreaSqm = "100" },
        };
        var withLines = InspectorDataDigestRules.Compute(Base, lines, "نص");
        var plain = Hashes(Base);

        Assert.NotEqual(plain["components"], withLines["components"]);
        foreach (var group in InspectorDataDigestRules.GroupKeys.Where(g => g != "components"))
            Assert.Equal(plain[group], withLines[group]);

        var edited = new[]
        {
            new BuildingInventoryLine { SortOrder = 1, StructureKind = "floor", Label = "الأرضي", AreaSqm = "120" },
        };
        Assert.NotEqual(
            withLines["components"],
            InspectorDataDigestRules.Compute(Base, edited, "نص")["components"]);
        Assert.NotEqual(
            withLines["components"],
            InspectorDataDigestRules.Compute(Base, lines, "نص مختلف")["components"]);
        // Row ids / timestamps / provenance are not part of the digest.
        var sameContent = new[]
        {
            new BuildingInventoryLine
            {
                Id = Guid.NewGuid(), SortOrder = 1, StructureKind = "floor", Label = "الأرضي", AreaSqm = "100",
                ProvenanceJson = "{\"x\":1}", UpdatedAtUtc = DateTime.UtcNow,
            },
        };
        Assert.Equal(
            withLines["components"],
            InspectorDataDigestRules.Compute(Base, sameContent, "نص")["components"]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[1,2]")]
    public void An_unreadable_payload_digests_as_empty_without_throwing(string? payload)
    {
        var hashes = InspectorDataDigestRules.Compute(payload);

        Assert.Equal(InspectorDataDigestRules.GroupKeys.Count, hashes.Count);
        Assert.Equal(Hashes("{}"), hashes);
    }

    [Fact]
    public void Missing_or_unreadable_baseline_reports_no_changed_group()
    {
        var current = Hashes(Base);

        Assert.Empty(InspectorDataDigestRules.ChangedGroups(null, current));
        Assert.Empty(InspectorDataDigestRules.ChangedGroups("", current));
        Assert.Empty(InspectorDataDigestRules.ChangedGroups("   ", current));
        Assert.Empty(InspectorDataDigestRules.ChangedGroups("garbage", current));
        Assert.Empty(InspectorDataDigestRules.ChangedGroups("area:", current));
        Assert.Empty(InspectorDataDigestRules.ChangedGroups("unknown:abc", current));
    }

    [Fact]
    public void Changed_groups_compare_the_acknowledged_baseline_with_the_current_data()
    {
        var seen = InspectorDataDigestRules.Fingerprint(Base);
        var current = Hashes(Mutate("\"builtArea\": \"300\"", "\"builtArea\": \"310\""));

        Assert.Equal(["area"], InspectorDataDigestRules.ChangedGroups(seen, current));
        Assert.Empty(InspectorDataDigestRules.ChangedGroups(seen, Hashes(Base)));
    }

    [Fact]
    public void A_baseline_that_lacks_a_group_does_not_flag_it()
    {
        var current = Hashes(Base);
        var partial = "area:" + current["area"] + ";age:000000000000";

        Assert.Equal(["age"], InspectorDataDigestRules.ChangedGroups(partial, current));
    }

    [Fact]
    public void Encode_and_decode_round_trip()
    {
        var hashes = Hashes(Base);

        var decoded = InspectorDataDigestRules.Decode(InspectorDataDigestRules.Encode(hashes));

        Assert.Equal(hashes, decoded);
        Assert.Null(InspectorDataDigestRules.Decode("area"));
        Assert.Null(InspectorDataDigestRules.Decode(null));
    }

    [Fact]
    public void Payload_only_comparison_names_the_moved_sections()
    {
        Assert.Equal(
            ["area", "narrative"],
            InspectorDataDigestRules.ChangedBetweenPayloads(
                Base,
                Mutate("\"builtArea\": \"300\"", "\"builtArea\": \"350\"")
                    .Replace("\"وصف\"", "\"وصف جديد\"")));
        Assert.Empty(InspectorDataDigestRules.ChangedBetweenPayloads(Base, Base));
    }
}
