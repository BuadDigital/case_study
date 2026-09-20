using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class PartyFieldProvenanceTests
{
    private static readonly DateTime T1 = new(2026, 9, 20, 8, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime T2 = T1.AddHours(1);
    private static readonly DateTime T3 = T1.AddHours(2);

    private static PartySubmissionActor Who(string id, string name, string role = "field-inspector") =>
        new() { UserId = id, DisplayName = name, PrototypeRole = role };

    private static PartyFieldProvenanceEntryDto Entry(string json, string key) =>
        PartyFieldProvenance.Parse(json)[key];

    [Fact]
    public void First_non_empty_value_stamps_the_writer()
    {
        var json = PartyFieldProvenance.Stamp("{}", "{}", """{"streetName":"الملك فهد"}""", Who("u1", "أحمد"), T1);

        var e = Entry(json, "streetName");
        Assert.Equal("أحمد", e.WrittenByName);
        Assert.Equal("field-inspector", e.WrittenByRole);
        Assert.Null(e.EditedByName);
    }

    [Fact]
    public void Same_person_refining_their_value_is_not_an_edit()
    {
        var first = PartyFieldProvenance.Stamp("{}", "{}", """{"streetName":"أ"}""", Who("u1", "أحمد"), T1);
        var second = PartyFieldProvenance.Stamp(first, """{"streetName":"أ"}""", """{"streetName":"ب"}""", Who("u1", "أحمد"), T2);

        var e = Entry(second, "streetName");
        Assert.Null(e.EditedByName);
        Assert.Equal(T2.ToString("O"), e.WrittenAtUtc);
    }

    [Fact]
    public void Another_person_changing_the_value_stamps_the_editor_and_keeps_the_writer()
    {
        var first = PartyFieldProvenance.Stamp("{}", "{}", """{"roomCount":"3"}""", Who("u1", "أحمد"), T1);
        var second = PartyFieldProvenance.Stamp(
            first, """{"roomCount":"3"}""", """{"roomCount":"4"}""", Who("u2", "أسامة", "case-specialist"), T2);

        var e = Entry(second, "roomCount");
        Assert.Equal("أحمد", e.WrittenByName);
        Assert.Equal("أسامة", e.EditedByName);
        Assert.Equal("case-specialist", e.EditedByRole);
        Assert.Equal(T2.ToString("O"), e.EditedAtUtc);
    }

    [Fact]
    public void Unchanged_keys_and_bookkeeping_keys_are_not_stamped()
    {
        var payload = """{"roomCount":"3","status":"draft","updatedAtUtc":"a"}""";
        var next = """{"roomCount":"3","status":"submitted","updatedAtUtc":"b"}""";

        var json = PartyFieldProvenance.Stamp("{}", payload, next, Who("u2", "أسامة"), T2);

        Assert.Equal("{}", json);
    }

    [Fact]
    public void Nested_objects_are_stamped_one_level_deep()
    {
        var json = PartyFieldProvenance.Stamp(
            "{}", """{"featureValues":{"assetSubject":"فيلا"}}""",
            """{"featureValues":{"assetSubject":"فيلا","kitchen":"جيد"}}""", Who("u1", "أحمد"), T1);

        var map = PartyFieldProvenance.Parse(json);
        Assert.Single(map);
        Assert.Contains("featureValues.kitchen", map.Keys);
    }

    [Fact]
    public void Legacy_value_without_provenance_records_the_editor_only()
    {
        var json = PartyFieldProvenance.Stamp(
            "{}", """{"roomCount":"3"}""", """{"roomCount":"5"}""", Who("u2", "أسامة", "case-specialist"), T2);

        var e = Entry(json, "roomCount");
        Assert.Null(e.WrittenByName);
        Assert.Equal("أسامة", e.EditedByName);
    }

    [Fact]
    public void Clearing_a_value_counts_as_an_edit_by_someone_else()
    {
        var first = PartyFieldProvenance.Stamp("{}", "{}", """{"note":"x"}""", Who("u1", "أحمد"), T1);
        var second = PartyFieldProvenance.Stamp(first, """{"note":"x"}""", """{"note":""}""", Who("u2", "أسامة"), T2);

        var e = Entry(second, "note");
        Assert.Equal("أحمد", e.WrittenByName);
        Assert.Equal("أسامة", e.EditedByName);
    }

    [Fact]
    public void Editing_again_by_the_latest_editor_only_moves_the_edit_time()
    {
        var a = PartyFieldProvenance.Stamp("{}", "{}", """{"n":"1"}""", Who("u1", "أحمد"), T1);
        var b = PartyFieldProvenance.Stamp(a, """{"n":"1"}""", """{"n":"2"}""", Who("u2", "أسامة"), T2);
        var c = PartyFieldProvenance.Stamp(b, """{"n":"2"}""", """{"n":"3"}""", Who("u2", "أسامة"), T3);

        var e = Entry(c, "n");
        Assert.Equal("أحمد", e.WrittenByName);
        Assert.Equal("أسامة", e.EditedByName);
        Assert.Equal(T3.ToString("O"), e.EditedAtUtc);
    }

    [Fact]
    public void No_identifiable_actor_leaves_provenance_untouched()
    {
        var json = PartyFieldProvenance.Stamp("{}", "{}", """{"a":"b"}""", null, T1);
        Assert.Equal("{}", json);
    }

    [Fact]
    public void Single_entry_changes_follow_the_same_writer_and_editor_rules()
    {
        var created = PartyFieldProvenance.NewEntryFor(Who("u1", "أحمد"), T1);
        Assert.Equal("أحمد", created.WrittenByName);

        var restored = PartyFieldProvenance.ParseSingle(PartyFieldProvenance.SerializeSingle(created));
        Assert.NotNull(restored);

        var edited = PartyFieldProvenance.ApplyChange(
            restored, previouslyEmpty: false, Who("u2", "أسامة", "case-specialist"), T2.ToString("O"));
        Assert.Equal("أحمد", edited.WrittenByName);
        Assert.Equal("أسامة", edited.EditedByName);

        var legacy = PartyFieldProvenance.ApplyChange(
            null, previouslyEmpty: false, Who("u2", "أسامة"), T2.ToString("O"));
        Assert.Null(legacy.WrittenByName);
        Assert.Equal("أسامة", legacy.EditedByName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("{}")]
    public void An_empty_stored_entry_parses_to_nothing(string? json)
    {
        Assert.Null(PartyFieldProvenance.ParseSingle(json));
    }
}
