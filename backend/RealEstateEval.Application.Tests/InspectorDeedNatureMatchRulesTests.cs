using System.Text.Json;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class InspectorDeedNatureMatchRulesTests
{
    private static JsonElement Root(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static Dictionary<string, string> Validate(
        string json,
        DeedKind kind = DeedKind.Traditional,
        string? availability = "deed") =>
        InspectorDeedNatureMatchRules.Validate(kind, availability, Root(json));

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"deedMatchesNature":""}""")]
    [InlineData("""{"deedMatchesNature":"maybe"}""")]
    [InlineData("""{"deedMatchesNature":null}""")]
    public void A_missing_or_empty_verdict_is_asked_for(string json)
    {
        var errors = Validate(json);

        Assert.Equal(InspectorDeedNatureMatchRules.VerdictRequired, errors["deedMatchesNature"]);
        Assert.Single(errors);
    }

    [Fact]
    public void Yes_with_no_boundary_object_is_accepted()
    {
        Assert.Empty(Validate("""{"deedMatchesNature":"yes"}"""));
    }

    [Fact]
    public void Yes_with_every_side_matching_is_accepted()
    {
        const string json = """
            {"deedMatchesNature":"yes","boundaryMatches":{
              "north":{"matches":true,"mismatchNote":""},
              "south":{"matches":true,"mismatchNote":""},
              "east":{"matches":true,"mismatchNote":""},
              "west":{"matches":true,"mismatchNote":""}}}
            """;

        Assert.Empty(Validate(json));
    }

    [Fact]
    public void Yes_while_a_side_does_not_match_is_a_contradiction()
    {
        const string json = """
            {"deedMatchesNature":"yes","boundaryMatches":{
              "east":{"matches":false,"mismatchNote":"فرق"}}}
            """;

        var errors = Validate(json);

        Assert.Equal(InspectorDeedNatureMatchRules.YesContradictsSides, errors["boundaries"]);
        Assert.Single(errors);
    }

    [Fact]
    public void No_needs_at_least_one_mismatching_side()
    {
        var errors = Validate("""
            {"deedMatchesNature":"no","boundaryMatches":{
              "north":{"matches":true,"mismatchNote":""}}}
            """);
        Assert.Equal(InspectorDeedNatureMatchRules.MismatchNeedsASide, errors["boundaries"]);

        var noObject = Validate("""{"deedMatchesNature":"no"}""");
        Assert.Equal(InspectorDeedNatureMatchRules.MismatchNeedsASide, noObject["boundaries"]);
    }

    [Fact]
    public void No_needs_a_note_on_every_mismatching_side()
    {
        const string json = """
            {"deedMatchesNature":"no","boundaryMatches":{
              "north":{"matches":false,"mismatchNote":"الطول أقل"},
              "south":{"matches":false,"mismatchNote":"   "}}}
            """;

        var errors = Validate(json);

        Assert.Equal(InspectorDeedNatureMatchRules.MismatchNeedsNotes, errors["boundaries"]);
    }

    [Fact]
    public void No_with_noted_mismatching_sides_is_accepted()
    {
        const string json = """
            {"deedMatchesNature":"No","boundaryMatches":{
              "north":{"matches":false,"mismatchNote":"الطول أقل"},
              "west":{"matches":true,"mismatchNote":""}}}
            """;

        Assert.Empty(Validate(json));
    }

    [Fact]
    public void A_registered_title_is_exempt()
    {
        Assert.Empty(Validate("{}", DeedKind.RegisteredTitle));
    }

    [Theory]
    [InlineData("no")]
    [InlineData(" NO ")]
    public void Unavailable_boundaries_are_exempt(string availability)
    {
        Assert.Empty(Validate("{}", DeedKind.Traditional, availability));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("deed")]
    [InlineData("bourse")]
    [InlineData("doc")]
    public void Any_other_availability_keeps_the_verdict_required(string? availability)
    {
        Assert.Contains("deedMatchesNature", Validate("{}", DeedKind.Traditional, availability).Keys);
    }

    [Fact]
    public void A_non_object_payload_is_tolerated()
    {
        var errors = InspectorDeedNatureMatchRules.Validate(
            DeedKind.Traditional, "deed", Root("[]"));

        Assert.Contains("deedMatchesNature", errors.Keys);
    }
}
