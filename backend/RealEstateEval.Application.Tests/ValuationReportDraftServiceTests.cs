using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The valuation-report draft: the case specialist prepares and sends it once the appraiser handed his
/// package over; the assigned appraiser approves it (the report freezes as the deposit copy) or takes his
/// approval back before any deposit code is recorded.
/// </summary>
public class ValuationReportDraftServiceTests
{
    private const string AppraiserDistributionId = "val-abdullah";
    /// <summary>The approval date is today's date: tests run on a fixed clock (2026-10-05, Riyadh).</summary>
    private static readonly DateTimeOffset ClockNow = new(2026, 10, 5, 9, 0, 0, TimeSpan.Zero);

    private const string Html = "<html dir=\"rtl\"><body>تقرير التقييم</body></html>";

    private static readonly ReportDraftActor Specialist = new()
    {
        UserId = "u-spec", DisplayName = "الأخصائي", PrototypeRole = "case-specialist",
    };

    private static readonly ReportDraftActor Appraiser = new()
    {
        UserId = "u-app", DisplayName = "المقيّم", PrototypeRole = "real-estate-appraiser",
        DistributionAssigneeId = AppraiserDistributionId,
    };

    private static JsonElement Choices(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private const string PrintChoices = "{\"printAttachmentKeys\":[\"deed\",\"survey\"]}";

    // ---- preparing ----

    [Fact]
    public async Task The_specialist_prepares_and_sends_the_draft_after_the_package_is_handed_over()
    {
        await using var rig = Arrange(PartyTaskSubmissionStatus.Submitted);

        var read = await rig.Service.GetAsync(rig.RequestId);
        Assert.Equal("none", read!.Status);
        Assert.True(read.CanPrepare);

        var (saved, saveErrors) = await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices(PrintChoices) }, Specialist);
        Assert.Null(saveErrors);
        Assert.Equal(ReportDraftStatuses.Preparing, saved!.Status);
        Assert.Equal("deed", saved.SpecialistChoices!.Value.GetProperty("printAttachmentKeys")[0].GetString());

        var (_, unconfirmed) = await rig.Service.SendAsync(
            rig.RequestId, new SendReportDraftRequest { ConformityConfirmed = false }, Specialist);
        Assert.Equal(ValuationReportDraft.ConformityRequiredAr, unconfirmed!["_"]);

        var (sent, sendErrors) = await rig.Service.SendAsync(
            rig.RequestId,
            new SendReportDraftRequest { ConformityConfirmed = true, Note = "راجع قسم المقارنات" },
            Specialist);
        Assert.Null(sendErrors);
        Assert.Equal(ReportDraftStatuses.Sent, sent!.Status);
        Assert.False(sent.CanPrepare);
        Assert.NotNull(sent.ConformityConfirmedAtUtc);

        var notice = Assert.Single(NoticePayloads(rig));
        Assert.Equal(ValuationNoticeAudiences.Appraiser, notice.GetProperty("Audience").GetString());
        Assert.Contains("راجع قسم المقارنات", notice.GetProperty("Body").GetString());
    }

    [Theory]
    [InlineData(PartyTaskSubmissionStatus.Draft)]
    [InlineData(PartyTaskSubmissionStatus.Reopened)]
    public async Task Nothing_is_prepared_before_the_package_is_submitted(string packageStatus)
    {
        await using var rig = Arrange(packageStatus);

        var read = await rig.Service.GetAsync(rig.RequestId);
        Assert.False(read!.CanPrepare);

        var (result, errors) = await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices(PrintChoices) }, Specialist);
        Assert.Null(result);
        Assert.Equal(ValuationReportDraftService.PackageNotSubmittedAr, errors!["_"]);
        Assert.Empty(rig.Contexts.Valuation.ValuationReportDrafts);
    }

    [Theory]
    [InlineData("section-supervisor")]
    [InlineData("cdo")]
    [InlineData("general-manager")]
    [InlineData("real-estate-appraiser")]
    public async Task Only_the_case_specialist_prepares_sends_and_withdraws(string role)
    {
        await using var rig = Arrange(PartyTaskSubmissionStatus.Submitted);
        var actor = new ReportDraftActor { UserId = "u-x", PrototypeRole = role, DistributionAssigneeId = AppraiserDistributionId };

        var save = await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices(PrintChoices) }, actor);
        var send = await rig.Service.SendAsync(
            rig.RequestId, new SendReportDraftRequest { ConformityConfirmed = true }, actor);
        var withdraw = await rig.Service.WithdrawAsync(rig.RequestId, new WithdrawReportDraftRequest(), actor);

        foreach (var errors in new[] { save.Errors, send.Errors, withdraw.Errors })
            Assert.Equal(ValuationReportDraftService.PrepareForbiddenAr, errors![ReportDraftErrorKeys.Forbidden]);
        Assert.Empty(rig.Contexts.Valuation.ValuationReportDrafts);
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("\"x\"")]
    [InlineData("{\"purposeKey\":\"sale\"}")]
    // ESG is the appraiser's own (decision 2026-10-06) — the specialist's draft refuses it.
    [InlineData("{\"esgEnv\":{\"none\":true,\"selected\":[],\"notes\":\"x\"}}")]
    public async Task Only_the_allow_listed_choice_keys_are_accepted(string json)
    {
        await using var rig = Arrange(PartyTaskSubmissionStatus.Submitted);

        var (result, errors) = await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices(json) }, Specialist);

        Assert.Null(result);
        Assert.True(errors!.ContainsKey("choices"));
    }

    [Fact]
    public async Task Saving_choices_after_sending_needs_a_withdrawal_first_and_a_resave_clears_the_confirmation()
    {
        await using var rig = Arrange(PartyTaskSubmissionStatus.Submitted);
        await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices(PrintChoices) }, Specialist);
        await rig.Service.SendAsync(rig.RequestId, new SendReportDraftRequest { ConformityConfirmed = true }, Specialist);

        var (_, whileSent) = await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices("{}") }, Specialist);
        Assert.Equal(ValuationReportDraft.NotPreparingAr, whileSent!["_"]);

        var (withdrawn, _) = await rig.Service.WithdrawAsync(
            rig.RequestId, new WithdrawReportDraftRequest { Note = "تعديل المرفقات" }, Specialist);
        Assert.Equal(ReportDraftStatuses.Preparing, withdrawn!.Status);
        Assert.Equal("تعديل المرفقات", withdrawn.SpecialistNote);
        Assert.Null(withdrawn.ConformityConfirmedAtUtc);

        // A repeated withdrawal is a no-op.
        var (again, againErrors) = await rig.Service.WithdrawAsync(
            rig.RequestId, new WithdrawReportDraftRequest(), Specialist);
        Assert.Null(againErrors);
        Assert.Equal(ReportDraftStatuses.Preparing, again!.Status);
    }

    // ---- approving ----

    [Fact]
    public async Task The_assigned_appraiser_approves_and_the_report_freezes_as_the_deposit_copy()
    {
        await using var rig = await ArrangeSentAsync();

        var (approved, errors) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = Html }, Appraiser);

        Assert.Null(errors);
        Assert.Equal(ReportDraftStatuses.Approved, approved!.Status);
        Assert.Equal("2026-10-05", approved.ReportDate);
        Assert.True(approved.HasSnapshot);
        Assert.Equal(64, approved.SnapshotSha256!.Length);
        Assert.Equal(Html, await rig.Service.GetApprovedSnapshotHtmlAsync(rig.RequestId));
        Assert.True(await ValuationReportFreeze.IsFrozenAsync(rig.Contexts.Valuation, rig.RequestId));

        Assert.Contains(
            NoticePayloads(rig),
            n => n.GetProperty("Audience").GetString() == ValuationNoticeAudiences.CaseSpecialist);

        // A repeated approval is a no-op that keeps the first snapshot.
        var (again, againErrors) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-04", Html = "<p>other</p>" }, Appraiser);
        Assert.Null(againErrors);
        Assert.Equal("2026-10-05", again!.ReportDate);
    }

    [Theory]
    [InlineData("section-supervisor", "u-sup", null)]
    [InlineData("cdo", "u-cdo", null)]
    [InlineData("case-specialist", "u-spec", null)]
    [InlineData("real-estate-appraiser", "u-other", "val-other")]
    public async Task Nobody_but_the_assigned_appraiser_approves(string role, string userId, string? distributionId)
    {
        await using var rig = await ArrangeSentAsync();
        var actor = new ReportDraftActor { UserId = userId, PrototypeRole = role, DistributionAssigneeId = distributionId };

        var (result, errors) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = Html }, actor);

        Assert.Null(result);
        Assert.Equal(ValuationReportDraftService.ReviewForbiddenAr, errors![ReportDraftErrorKeys.Forbidden]);
        Assert.False(await ValuationReportFreeze.IsFrozenAsync(rig.Contexts.Valuation, rig.RequestId));
    }

    [Fact]
    public async Task Approving_needs_a_sent_draft_a_valid_date_and_the_printed_report()
    {
        await using var rig = Arrange(PartyTaskSubmissionStatus.Submitted);
        await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices("{}") }, Specialist);

        var (_, notSent) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = Html }, Appraiser);
        Assert.Equal(ValuationReportDraft.NotSentAr, notSent!["_"]);

        await rig.Service.SendAsync(rig.RequestId, new SendReportDraftRequest { ConformityConfirmed = true }, Specialist);

        var (_, badDate) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "05/10/2026", Html = Html }, Appraiser);
        Assert.Equal(ValuationReportDraft.ReportDateInvalidAr, badDate!["_"]);

        // The report date is the approval date: a device clock more than a day off is refused.
        var (_, wrongDay) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-12", Html = Html }, Appraiser);
        Assert.Equal(ValuationReportDraft.ReportDateNotTodayAr, wrongDay!["_"]);

        var (_, noHtml) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = "" }, Appraiser);
        Assert.Equal(ValuationReportDraft.SnapshotRequiredAr, noHtml!["_"]);
        Assert.False(await ValuationReportFreeze.IsFrozenAsync(rig.Contexts.Valuation, rig.RequestId));
    }

    [Fact]
    public async Task Once_approved_the_specialist_can_neither_edit_nor_withdraw()
    {
        await using var rig = await ArrangeSentAsync();
        await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = Html }, Appraiser);

        var (_, edit) = await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices("{}") }, Specialist);
        var (_, withdraw) = await rig.Service.WithdrawAsync(
            rig.RequestId, new WithdrawReportDraftRequest(), Specialist);

        Assert.Equal(ValuationReportDraftService.AlreadyApprovedAr, edit!["_"]);
        Assert.Equal(ValuationReportDraft.ApprovedCannotBeWithdrawnAr, withdraw!["_"]);
    }

    // ---- withdrawing the approval ----

    [Fact]
    public async Task The_appraiser_takes_his_approval_back_without_spending_a_version_and_approves_again()
    {
        await using var rig = await ArrangeSentAsync();
        await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = Html }, Appraiser);

        var (back, errors) = await rig.Service.WithdrawApprovalAsync(
            rig.RequestId, new WithdrawReportDraftRequest { Note = "أصحح الرأي" }, Appraiser);

        Assert.Null(errors);
        Assert.Equal(ReportDraftStatuses.Sent, back!.Status);
        Assert.Equal("أصحح الرأي", back.AppraiserNote);
        Assert.False(back.HasSnapshot);
        Assert.False(await ValuationReportFreeze.IsFrozenAsync(rig.Contexts.Valuation, rig.RequestId));
        Assert.Empty(rig.Contexts.Valuation.ValuationReportIssuances);

        var (second, secondErrors) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-06", Html = Html }, Appraiser);
        Assert.Null(secondErrors);
        Assert.Equal(1, second!.Version);
        Assert.Equal(1, (await rig.Contexts.Valuation.ValuationReportIssuances.SingleAsync()).Version);
    }

    [Fact]
    public async Task The_approval_cannot_be_taken_back_once_the_deposit_code_is_recorded()
    {
        await using var rig = await ArrangeSentAsync();
        await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = Html }, Appraiser);
        var issuance = rig.Contexts.Valuation.ValuationReportIssuances.Single();
        issuance.DepositCode = "QYM-1";
        await rig.Contexts.Valuation.SaveChangesAsync();

        var (result, errors) = await rig.Service.WithdrawApprovalAsync(
            rig.RequestId, new WithdrawReportDraftRequest(), Appraiser);

        Assert.Null(result);
        Assert.Equal(ValuationReportIssuanceService.DepositRecordedCannotWithdrawAr, errors!["_"]);
        Assert.Equal(ReportDraftStatuses.Approved, (await rig.Contexts.Valuation.ValuationReportDrafts.SingleAsync()).Status);
    }

    [Fact]
    public async Task Only_the_assigned_appraiser_takes_the_approval_back()
    {
        await using var rig = await ArrangeSentAsync();
        await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = Html }, Appraiser);

        var (result, errors) = await rig.Service.WithdrawApprovalAsync(
            rig.RequestId, new WithdrawReportDraftRequest(), Specialist);

        Assert.Null(result);
        Assert.Equal(ValuationReportDraftService.ReviewForbiddenAr, errors![ReportDraftErrorKeys.Forbidden]);
        Assert.True(await ValuationReportFreeze.IsFrozenAsync(rig.Contexts.Valuation, rig.RequestId));
    }

    // ---- arrangement ----

    /// <summary>The staged workflow notices as parsed payload objects (JSON escapes Arabic text).</summary>
    private static List<JsonElement> NoticePayloads(Rig rig) =>
        rig.Contexts.Valuation.OutboxMessages
            .Where(x => x.EventType == IntegrationEventTypes.ValuationWorkflowNotice)
            .AsEnumerable()
            .Select(x => JsonDocument.Parse(x.PayloadJson).RootElement.GetProperty("Payload").Clone())
            .ToList();

    private static async Task<Rig> ArrangeSentAsync()
    {
        var rig = Arrange(PartyTaskSubmissionStatus.Submitted);
        await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = Choices(PrintChoices) }, Specialist);
        await rig.Service.SendAsync(
            rig.RequestId, new SendReportDraftRequest { ConformityConfirmed = true }, Specialist);
        return rig;
    }

    private static Rig Arrange(string packageStatus)
    {
        var contexts = TestDatabases.Create("report-draft");
        var propertyId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        contexts.Valuation.ValuationRequests.Add(ValuationRequest.Create(
            requestId, "VR-D1", propertyId, "جدة", "فيلا", "مقيم", "2026-06-25", DateTime.UtcNow));
        contexts.Valuation.SaveChanges();

        var taskId = Guid.NewGuid();
        contexts.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.PropertyAppraisal, "PO-D", DateTime.UtcNow, title: "تقييم",
            phase: WorkflowTaskPhase.Done, id: taskId, propertyId: propertyId,
            assigneeId: AppraiserDistributionId));
        var package = PartyTaskSubmission.CreateDraft(
            taskId, WorkflowTaskKindValues.PropertyAppraisal, propertyId, "PO-D", DateTime.UtcNow);
        package.Status = packageStatus;
        contexts.CaseStudy.PartyTaskSubmissions.Add(package);
        contexts.CaseStudy.SaveChanges();

        var lookup = new CaseStudyLookup(contexts.CaseStudy);
        var events = new ValuationOutboxPublisher(contexts.Valuation, NullLogger<ValuationOutboxPublisher>.Instance);
        var issuance = new ValuationReportIssuanceService(
            contexts.Valuation, new StubGates(), new StubDocuments(), events: events, caseStudy: lookup);
        return new Rig(
            contexts, requestId,
            new ValuationReportDraftService(contexts.Valuation, issuance, lookup, events, new FixedClock(ClockNow)));
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class Rig(TestDatabases.ContextSet contexts, Guid requestId, ValuationReportDraftService service)
        : IAsyncDisposable
    {
        public TestDatabases.ContextSet Contexts { get; } = contexts;
        public Guid RequestId { get; } = requestId;
        public ValuationReportDraftService Service { get; } = service;
        public ValueTask DisposeAsync() => Contexts.DisposeAsync();
    }

    private sealed class StubGates : IValuationIssuanceGateService
    {
        public Task<ValuationIssuanceGatesDto?> EvaluateAsync(
            Guid valuationRequestId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationIssuanceGatesDto?>(new ValuationIssuanceGatesDto
            {
                ValuationRequestId = valuationRequestId,
                AllowsIssuance = true,
                BlockingReasonsAr = [],
            });
    }

    private sealed class StubDocuments : IValuationReportDocumentService
    {
        public Task<ValuationReportDocumentDto?> GetPreviewAsync(
            Guid valuationRequestId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationReportDocumentDto?>(new ValuationReportDocumentDto
            {
                ValuationRequestId = valuationRequestId,
                DisplayId = "VR-TEST",
                ReportDateDisplay = "2026/10/05",
                FinalOpinionDisplay = "1,000,000 ريال",
                Sections = [],
            });
    }
}
