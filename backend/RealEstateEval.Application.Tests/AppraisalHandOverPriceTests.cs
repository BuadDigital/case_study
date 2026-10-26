using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The appraiser's handed-over price (سعر التقييم) must equal the reconciliation's final value (±0.5).
/// Evidence r8b: 9,830,000 was handed over while the final was 9,220,000.
/// </summary>
public class AppraisalHandOverPriceTests
{
    private static readonly Guid Parent = Guid.Parse("c0000000-0000-0000-0000-0000000000a1");
    private static readonly Guid Appraisal = Guid.Parse("c1000000-0000-0000-0000-0000000000a1");
    private static readonly Guid Property = Guid.Parse("c3000000-0000-0000-0000-0000000000a1");

    private static readonly PartySubmissionActor Appraiser = new()
    {
        UserId = "appraiser-user",
        DisplayName = "المقيّم",
        PrototypeRole = "real-estate-appraiser",
        DistributionAssigneeId = "dist-appraiser",
    };

    [Theory]
    [InlineData("9220000", true)]
    [InlineData("9220000.4", true)]
    [InlineData("9219999.5", true)]
    [InlineData("9220001", false)]
    [InlineData("9830000", false)]
    public void The_price_must_equal_the_final_within_half_a_riyal(string price, bool ok)
    {
        var error = AppraisalHandOverPriceRules.MismatchError(
            decimal.Parse(price, System.Globalization.CultureInfo.InvariantCulture), 9_220_000m);
        Assert.Equal(ok, error is null);
    }

    [Fact]
    public void The_refusal_names_both_figures_in_latin_digits()
    {
        var message = AppraisalHandOverPriceRules.MismatchError(9_830_000m, 9_220_000m)![AppraisalHandOverPriceRules.ErrorKey];
        Assert.Contains("9,830,000", message);
        Assert.Contains("9,220,000", message);
        Assert.Contains("لا يطابق القيمة النهائية", message);
    }

    [Fact]
    public void Nothing_to_compare_without_a_final_or_a_price()
    {
        Assert.Null(AppraisalHandOverPriceRules.MismatchError(9_830_000m, null));
        Assert.Null(AppraisalHandOverPriceRules.MismatchError(9_830_000m, 0m));
        Assert.Null(AppraisalHandOverPriceRules.MismatchError(null, 9_220_000m));
    }

    [Fact]
    public async Task A_hand_over_price_other_than_the_final_is_refused()
    {
        await using var rig = Arrange("9830000", new FinalAnswer(9_220_000m));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(result);
        Assert.Contains("9,220,000", errors![AppraisalHandOverPriceRules.ErrorKey]);
        Assert.Equal(
            PartyTaskSubmissionStatus.Draft,
            (await rig.Contexts.CaseStudy.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == Appraisal)).Status);
    }

    [Fact]
    public async Task The_final_value_hands_over()
    {
        await using var rig = Arrange("9,220,000", new FinalAnswer(9_220_000m));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(errors);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, result!.Status);
    }

    [Theory]
    [InlineData("9,220,000")]
    [InlineData("٩٬٢٢٠٬٠٠٠")]
    public async Task The_handed_over_price_is_stored_normalised_and_the_old_return_note_is_cleared(string typed)
    {
        await using var rig = Arrange(typed, new FinalAnswer(9_220_000m));
        var draft = await rig.Contexts.CaseStudy.PartyTaskSubmissions.SingleAsync(s => s.WorkflowTaskId == Appraisal);
        draft.Status = PartyTaskSubmissionStatus.Reopened;
        draft.ReturnNote = "صحّح سعر التقييم";
        await rig.Contexts.CaseStudy.SaveChangesAsync();

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(errors);
        Assert.Null(result!.ReturnNote);
        var stored = await rig.Contexts.CaseStudy.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == Appraisal);
        Assert.Null(stored.ReturnNote);
        using var doc = JsonDocument.Parse(stored.PayloadJson);
        Assert.Equal("9220000", doc.RootElement.GetProperty("evaluatorPrice").GetString());
    }

    [Theory]
    [InlineData("970000.4")]
    [InlineData("969999.5")]
    public async Task A_price_accepted_within_the_slack_is_stored_as_the_final_value(string typed)
    {
        await using var rig = Arrange(typed, new FinalAnswer(970_000m));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(errors);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, result!.Status);
        var stored = await rig.Contexts.CaseStudy.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == Appraisal);
        using var doc = JsonDocument.Parse(stored.PayloadJson);
        Assert.Equal("970000", doc.RootElement.GetProperty("evaluatorPrice").GetString());
    }

    [Fact]
    public void The_final_price_rewrite_leaves_a_mismatch_or_no_final_untouched()
    {
        const string payload = """{"evaluatorPrice":"980000"}""";
        Assert.Equal(payload, AppraisalHandOverPriceRules.WithFinalPrice(payload, 980_000m, 970_000m));
        Assert.Equal(payload, AppraisalHandOverPriceRules.WithFinalPrice(payload, 980_000m, null));
        Assert.Contains(
            "\"970000\"",
            AppraisalHandOverPriceRules.WithFinalPrice("""{"evaluatorPrice":970000.4}""", 970_000.4m, 970_000m));
    }

    [Fact]
    public void Price_normalisation_leaves_a_non_number_untouched()
    {
        Assert.Equal("""{"evaluatorPrice":"abc"}""", PropertyAppraisalSubmissionValidator.NormalizePrice("""{"evaluatorPrice":"abc"}"""));
        Assert.Equal("not json", PropertyAppraisalSubmissionValidator.NormalizePrice("not json"));
        Assert.Contains("\"1000.5\"", PropertyAppraisalSubmissionValidator.NormalizePrice("""{"evaluatorPrice":"1,000.50"}"""));
    }

    [Fact]
    public async Task An_unreadable_final_fails_closed()
    {
        await using var rig = Arrange("9220000", new FinalAnswer(Throws: true));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(result);
        Assert.Equal(AppraisalHandOverPriceRules.UnverifiedAr, errors![AppraisalHandOverPriceRules.ErrorKey]);
    }

    [Fact]
    public async Task A_timed_out_final_read_fails_closed_instead_of_a_500()
    {
        await using var rig = Arrange("9220000", new FinalAnswer(TimesOut: true));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(result);
        Assert.Equal(AppraisalHandOverPriceRules.UnverifiedAr, errors![AppraisalHandOverPriceRules.ErrorKey]);
    }

    [Fact]
    public async Task Without_a_reconciliation_the_price_is_not_compared()
    {
        await using var rig = Arrange("9830000", new FinalAnswer(null));

        var (_, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(errors);
    }

    private static Rig Arrange(string price, FinalAnswer answer)
    {
        var contexts = TestDatabases.Create("handover-price");
        var db = contexts.CaseStudy;
        var now = DateTime.UtcNow;
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, "PO-HP", now, title: "دراسة",
                phase: WorkflowTaskPhase.CaseStudy, id: Parent, propertyId: Property),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal, "PO-HP", now, title: "تقييم",
                phase: WorkflowTaskPhase.Done, assigneeRole: "real-estate-appraiser",
                id: Appraisal, propertyId: Property, parentTaskId: Parent, assigneeId: "dist-appraiser"));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = Appraisal,
            Kind = WorkflowTaskKindValues.PropertyAppraisal,
            Status = PartyTaskSubmissionStatus.Draft,
            PropertyId = Property,
            PoNumber = "PO-HP",
            PayloadJson = JsonSerializer.Serialize(new { status = "draft", evaluatorPrice = price }),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.CaseStudyReports.Add(new CaseStudyReport
        {
            Id = Guid.NewGuid(),
            TaskId = Parent,
            IsPartyContribution = false,
            PropertyId = Property,
            PoNumber = "PO-HP",
            Status = "issued",
            AnswersJson = "{}",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();

        var failures = TestInspectorFeeServiceFactory.ShareFailures(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        var service = new PartyTaskSubmissionService(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(failures)),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
            new FixedRole(null),
            TestInspectorFeeServiceFactory.Create(db),
            notifications,
            recipients,
            new AuditLogWriter(),
            new RecordingAuditLogAppend(),
            valuationRequests: answer);
        return new Rig(contexts, service);
    }

    /// <summary>The valuation port: an open request with passing gates and the given final (or a failed read).</summary>
    private sealed class FinalAnswer(decimal? final = null, bool Throws = false, bool TimesOut = false) : IValuationRequestService
    {
        public Task<decimal?> GetFinalOpinionValueAsync(Guid valuationRequestId, CancellationToken cancellationToken = default) =>
            Throws ? throw new HttpRequestException("valuation down")
            : TimesOut ? throw new TaskCanceledException("HttpClient.Timeout")
            : Task.FromResult(final);

        public Task<ValuationIssuanceGatesSnapshotDto?> GetIssuanceGatesAsync(
            Guid valuationRequestId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationIssuanceGatesSnapshotDto?>(new ValuationIssuanceGatesSnapshotDto { AllowsIssuance = true });

        public Task<ValuationRequestDto?> GetOpenByPropertyAsync(
            string propertyId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationRequestDto?>(new ValuationRequestDto
            {
                Id = Guid.NewGuid(),
                DisplayId = "VR-HP",
                PropId = propertyId,
                Area = "جدة",
                Type = "فيلا",
                Appraiser = "مقيّم",
                Status = "progress",
                Date = "2026-10-01",
            });

        public Task<IReadOnlyList<ValuationRequestDto>> ListAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ValuationRequestDto>>([]);

        public Task<ValuationRequestDto?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationRequestDto?>(null);

        public Task<(ValuationRequestDto? Result, string? Error)> CreateAsync(
            SaveValuationRequestRequest request,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<(ValuationRequestDto? Result, string? Error)> EnsureOpenByPropertyAsync(
            SaveValuationRequestRequest request,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<(ValuationRequestDto? Result, string? Error)> SubmitReportAsync(
            Guid id,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<(ValuationRequestDto? Result, string? Error)> RecordImpedimentAsync(
            Guid id,
            ValuationImpedimentRequest request,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class Rig(TestDatabases.ContextSet contexts, PartyTaskSubmissionService service) : IAsyncDisposable
    {
        public TestDatabases.ContextSet Contexts { get; } = contexts;
        public PartyTaskSubmissionService Service { get; } = service;
        public ValueTask DisposeAsync() => Contexts.DisposeAsync();
    }

    private sealed class FixedRole(string? role) : ICurrentPrototypeRoleResolver
    {
        public Task<string?> ResolveAsync(CancellationToken cancellationToken) => Task.FromResult(role);
    }
}
