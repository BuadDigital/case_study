using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The 100% completeness rule: required = bank questions with a real role in the matrix, answered =
/// A / B / NA; it fails closed. Plus the question bank pin and the HTTP read of the matrix.
/// </summary>
public class CaseStudyAnswerCompletenessRulesTests
{
    private static IReadOnlyDictionary<string, IReadOnlyCollection<string>> Matrix(
        params (string Key, string[] Parties)[] rows) =>
        rows.ToDictionary(r => r.Key, r => (IReadOnlyCollection<string>)r.Parties);

    private static Dictionary<string, object?> Answers(params (string Key, object? Value)[] rows) =>
        rows.ToDictionary(r => r.Key, r => r.Value);

    [Fact]
    public void Complete_when_every_required_question_is_answered()
    {
        var result = CaseStudyAnswerCompletenessRules.Evaluate(
            Matrix(("deed_0", ["specA"]), ("survey_1", ["insp"])),
            Answers(("deed_0", "A"), ("survey_1", "B")));

        Assert.True(result.Complete);
        Assert.Equal(2, result.Required);
        Assert.Equal(2, result.Answered);
        Assert.Null(CaseStudyAnswerCompletenessRules.ToErrors(result));
    }

    [Theory]
    [InlineData("A", true)]
    [InlineData("B", true)]
    [InlineData("NA", true)]
    [InlineData("a", false)]
    [InlineData("yes", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Answered_means_exactly_A_B_or_NA(string? value, bool expected) =>
        Assert.Equal(expected, CaseStudyAnswerCompletenessRules.IsAnswered(value));

    [Fact]
    public void A_json_string_value_counts_like_a_string_and_other_json_kinds_do_not()
    {
        using var doc = JsonDocument.Parse("""{"a":"NA","b":1,"c":null,"d":{"x":"A"}}""");
        Assert.True(CaseStudyAnswerCompletenessRules.IsAnswered(doc.RootElement.GetProperty("a").Clone()));
        Assert.False(CaseStudyAnswerCompletenessRules.IsAnswered(doc.RootElement.GetProperty("b").Clone()));
        Assert.False(CaseStudyAnswerCompletenessRules.IsAnswered(doc.RootElement.GetProperty("c").Clone()));
        Assert.False(CaseStudyAnswerCompletenessRules.IsAnswered(doc.RootElement.GetProperty("d").Clone()));
    }

    [Fact]
    public void Questions_without_a_party_in_the_matrix_are_hidden_and_never_required()
    {
        var result = CaseStudyAnswerCompletenessRules.Evaluate(
            Matrix(("deed_0", ["specA"]), ("deed_1", []), ("deed_2", [" "])),
            Answers(("deed_0", "A")));

        Assert.True(result.Complete);
        Assert.Equal(1, result.Required);
    }

    [Fact]
    public void Stale_foreign_and_note_keys_are_neither_required_nor_counted()
    {
        var result = CaseStudyAnswerCompletenessRules.Evaluate(
            Matrix(
                ("deed_0", ["specA"]),
                ("deed_11", ["specA"]),                  // past the bank (deed has 11: 0..10)
                ("legacy_0", ["specA"]),                 // not a bank section
                ("__answerNotes", ["specA"])),           // the notes object is not a question
            Answers(("deed_0", "A")));

        Assert.True(result.Complete);
        Assert.Equal(1, result.Required);
    }

    [Fact]
    public void Missing_keys_are_listed_in_wizard_order_with_the_count_message()
    {
        var result = CaseStudyAnswerCompletenessRules.Evaluate(
            Matrix(("occ_1", ["eng"]), ("deed_10", ["specA"]), ("deed_2", ["specA"]), ("extra_0", ["sup"])),
            Answers(("deed_2", "A")));

        Assert.False(result.Complete);
        Assert.Equal(["deed_10", "occ_1", "extra_0"], result.MissingKeys);
        var errors = CaseStudyAnswerCompletenessRules.ToErrors(result)!;
        Assert.Equal("أسئلة ناقصة: 3 من 4", errors["answers"]);
        Assert.Equal("deed_10,occ_1,extra_0", errors["missingQuestionKeys"]);
    }

    [Fact]
    public void An_answers_notes_object_does_not_answer_a_question()
    {
        var result = CaseStudyAnswerCompletenessRules.Evaluate(
            Matrix(("comp_2", ["specA"])),
            Answers(("__answerNotes", new Dictionary<string, string> { ["comp_2"] = "ملاحظة" })));

        Assert.False(result.Complete);
        Assert.Equal(["comp_2"], result.MissingKeys);
    }

    [Fact]
    public void A_null_answers_map_leaves_every_required_question_missing()
    {
        var result = CaseStudyAnswerCompletenessRules.Evaluate(Matrix(("deed_0", ["specA"])), null);
        Assert.Equal(["deed_0"], result.MissingKeys);
    }

    [Fact]
    public void An_unreadable_matrix_fails_closed()
    {
        var result = CaseStudyAnswerCompletenessRules.Evaluate(null, Answers(("deed_0", "A")));

        Assert.False(result.Complete);
        Assert.Equal(
            CaseStudyAnswerCompletenessRules.MatrixUnavailableAr,
            CaseStudyAnswerCompletenessRules.ToErrors(result)!["answers"]);
    }

    [Fact]
    public void An_empty_matrix_or_one_with_no_real_role_fails_closed()
    {
        foreach (var matrix in new[]
                 {
                     Matrix(),
                     Matrix(("deed_0", []), ("survey_1", [])),
                     Matrix(("foreign_9", ["specA"])),
                 })
        {
            var result = CaseStudyAnswerCompletenessRules.Evaluate(matrix, Answers(("deed_0", "A")));
            Assert.False(result.Complete);
            Assert.Equal(
                CaseStudyAnswerCompletenessRules.MatrixEmptyAr,
                CaseStudyAnswerCompletenessRules.ToErrors(result)!["answers"]);
        }
    }

    // ---------------------------------------------------------------- the question bank

    [Fact]
    public void The_bank_matches_the_frontend_catalogue_sizes()
    {
        // packages/app-shared/src/app-data/property-fields-catalog.ts: groups case-study-deed/-survey/-comp/-occ/-extra.
        Assert.Equal(11, CaseStudyQuestionBank.DeedCount);
        Assert.Equal(7, CaseStudyQuestionBank.SurveyCount);
        Assert.Equal(9, CaseStudyQuestionBank.CompCount);
        Assert.Equal(6, CaseStudyQuestionBank.OccCount);
        Assert.Equal(4, CaseStudyQuestionBank.ExtraCount);
        Assert.Equal(37, CaseStudyQuestionBank.TotalCount);
        Assert.Equal(37, CaseStudyQuestionBank.AllKeys.Count);
    }

    [Fact]
    public void Bank_keys_are_zero_based_and_match_the_wire_pattern()
    {
        var pattern = new System.Text.RegularExpressions.Regex(@"^(deed|survey|comp|occ|extra)_\d+$");
        Assert.All(CaseStudyQuestionBank.AllKeys, key => Assert.Matches(pattern, key));
        Assert.True(CaseStudyQuestionBank.IsQuestionKey("deed_0"));
        Assert.True(CaseStudyQuestionBank.IsQuestionKey("deed_10"));
        Assert.False(CaseStudyQuestionBank.IsQuestionKey("deed_11"));
        Assert.True(CaseStudyQuestionBank.IsQuestionKey("extra_3"));
        Assert.False(CaseStudyQuestionBank.IsQuestionKey("extra_4"));
        Assert.False(CaseStudyQuestionBank.IsQuestionKey(CaseStudyQuestionBank.AnswerNotesKey));
        Assert.False(CaseStudyQuestionBank.IsQuestionKey(null));
    }

    // ---------------------------------------------------------------- the HTTP read

    [Fact]
    public async Task The_http_lookup_reads_the_matrix_and_drops_none_roles()
    {
        var handler = new StubHandler(HttpStatusCode.OK, """
            {"matrix":{"deed_0":{"specA":"primary","insp":"none"},"survey_1":{"val":"verify"},"comp_2":{}},
             "notes":{},"updatedAt":"2026-10-04T00:00:00Z"}
            """);
        var lookup = CreateLookup(handler, bearer: "Bearer user-token");

        var matrix = await lookup.GetQuestionRolesAsync();

        Assert.NotNull(matrix);
        Assert.Equal(["specA"], matrix!["deed_0"]);
        Assert.Equal(["val"], matrix["survey_1"]);
        Assert.Empty(matrix["comp_2"]);
        Assert.Equal("http://platform.test/api/case-study-info-roles", handler.LastRequest!.RequestUri!.ToString());
        Assert.Equal("Bearer user-token", handler.LastRequest.Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task The_http_lookup_answers_null_when_the_upstream_fails_or_the_body_is_empty()
    {
        Assert.Null(await CreateLookup(new StubHandler(HttpStatusCode.InternalServerError, "{}"))
            .GetQuestionRolesAsync());
        Assert.Null(await CreateLookup(new StubHandler(HttpStatusCode.NotFound, "{}"))
            .GetQuestionRolesAsync());
        Assert.Null(await CreateLookup(new StubHandler(HttpStatusCode.OK, "null"))
            .GetQuestionRolesAsync());
        Assert.Null(await CreateLookup(new StubHandler(HttpStatusCode.OK, "{}"))
            .GetQuestionRolesAsync());
        Assert.Null(await CreateLookup(new StubHandler(throws: true)).GetQuestionRolesAsync());
    }

    private static HttpCaseStudyInfoRolesLookup CreateLookup(StubHandler handler, string? bearer = null)
    {
        var context = new DefaultHttpContext();
        if (bearer is not null) context.Request.Headers.Authorization = bearer;
        return new HttpCaseStudyInfoRolesLookup(
            new HttpClient(handler),
            new HttpContextAccessor { HttpContext = context },
            Options.Create(new UpstreamServicesOptions { PlatformBaseUrl = "http://platform.test" }));
    }

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _body;
        private readonly bool _throws;

        public StubHandler(HttpStatusCode status, string body)
        {
            _status = status;
            _body = body;
        }

        public StubHandler(bool throws)
        {
            _status = HttpStatusCode.OK;
            _body = "";
            _throws = throws;
        }

        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            LastRequest = request;
            if (_throws) throw new HttpRequestException("upstream down");
            return Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent(_body, Encoding.UTF8, "application/json"),
            });
        }
    }
}
