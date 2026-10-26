using System.Text.Json;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Round 2: the framework's English 400 messages («The Methods field is required.», «… maximum
/// length of '4000'», «The value 'abc' is not valid for Take.», «A non-empty request body is
/// required.») reach the screens in Arabic, keyed by the same model-state field.
/// </summary>
public class ArabicInvalidModelStateTests
{
    private static ModelStateDictionary State(params (string Key, string Message)[] errors)
    {
        var state = new ModelStateDictionary();
        foreach (var (key, message) in errors)
            state.AddModelError(key, message);
        return state;
    }

    private static IReadOnlyList<string> MessagesOf(ModelStateDictionary state, string key) =>
        state[key]!.Errors.Select(e => e.ErrorMessage).ToList();

    [Theory]
    [InlineData("Methods", "The Methods field is required.", "الحقل «methods» مطلوب")]
    [InlineData("scope", "The scope field is required.", "الحقل «scope» مطلوب")]
    [InlineData("AnalysisNotes",
        "The field AnalysisNotes must be a string or array type with a maximum length of '4000'.",
        "الحقل «analysisNotes» يتجاوز الحد الأقصى (4000 حرفاً)")]
    [InlineData("Username",
        "The field Username must be a string or array type with a minimum length of '2'.",
        "الحقل «username» أقصر من الحد الأدنى (2 أحرف)")]
    [InlineData("Pct", "The field Pct must be between 0 and 100.", "قيمة الحقل «pct» يجب أن تكون بين 0 و 100")]
    public void Generic_english_templates_are_rewritten_in_arabic_keeping_the_key(
        string key,
        string english,
        string arabic)
    {
        var translated = ArabicInvalidModelState.Translate(State((key, english)));

        Assert.Equal([arabic], MessagesOf(translated, key));
    }

    [Fact]
    public void An_invalid_query_value_names_the_field_in_arabic()
    {
        var translated = ArabicInvalidModelState.Translate(State(("Take", "The value 'abc' is not valid for Take.")));

        var message = Assert.Single(MessagesOf(translated, "Take"));
        Assert.Equal(ArabicInvalidModelState.FieldValueInvalidAr("take"), message);
    }

    [Fact]
    public void Nested_keys_are_camel_cased_in_the_message_only()
    {
        var translated = ArabicInvalidModelState.Translate(
            State(("Items[0].Rationale", "The Rationale field is required.")));

        Assert.Equal(["الحقل «items[0].rationale» مطلوب"], MessagesOf(translated, "Items[0].Rationale"));
    }

    [Fact]
    public void Arabic_messages_from_the_dtos_pass_unchanged()
    {
        const string own = "رمز الإيداع مطلوب";
        var translated = ArabicInvalidModelState.Translate(State(("DepositCode", own)));

        Assert.Equal([own], MessagesOf(translated, "DepositCode"));
    }

    [Fact]
    public void A_missing_body_answers_once_in_arabic_without_the_derived_required()
    {
        var translated = ArabicInvalidModelState.Translate(State(
            ("", "A non-empty request body is required."),
            ("request", "The request field is required.")));

        var all = translated.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
        Assert.Equal([ArabicInvalidModelState.BodyMissingAr], all);
    }

    [Fact]
    public void Unknown_english_text_never_leaks()
    {
        var translated = ArabicInvalidModelState.Translate(State(("Code", "Something odd happened.")));

        Assert.Equal([ArabicInvalidModelState.FieldValueInvalidAr("code")], MessagesOf(translated, "Code"));
    }

    [Fact]
    public void Json_conversion_failures_keep_the_field_path()
    {
        var state = new ModelStateDictionary();
        state.TryAddModelException("$.lines[0].unitCostSar", new JsonException("bad"));
        state.AddModelError("request", "The request field is required.");

        var translated = ArabicInvalidModelState.Translate(state);

        Assert.Equal(
            [ArabicInvalidModelState.FieldValueInvalidAr("lines[0].unitCostSar")],
            MessagesOf(translated, "lines[0].unitCostSar"));
        Assert.False(translated.ContainsKey("request"));
    }
}
