using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The deposit step and the new version: the assigned appraiser records the Qeema deposit code with a
/// one-page PDF certificate (both required, the code correctable afterwards, audited); the specialist
/// reopens a deposited report as a new version (n+1) — which first returns the appraiser's package and task.
/// </summary>
public class ValuationDepositAndNewVersionTests
{
    private const string AppraiserDistributionId = "val-abdullah";

    private static readonly ReportDraftActor Specialist = new()
    {
        UserId = "u-spec", PrototypeRole = "case-specialist",
    };

    private static readonly ReportDraftActor Appraiser = new()
    {
        UserId = "u-app", PrototypeRole = "real-estate-appraiser", DistributionAssigneeId = AppraiserDistributionId,
    };

    // ---- the certificate rules ----

    [Fact]
    public void The_certificate_is_a_pdf_of_one_page()
    {
        Assert.Null(DepositCertificateRules.Validate(TestPdf.OnePage, "application/pdf", "c.pdf"));
        Assert.Equal(DepositCertificateRules.OnePageAr, DepositCertificateRules.Validate(TestPdf.TwoPages, "application/pdf", "c.pdf"));
        Assert.Equal(DepositCertificateRules.NotPdfAr, DepositCertificateRules.Validate([1, 2, 3], "application/pdf", "c.pdf"));
        Assert.Equal(DepositCertificateRules.NotPdfAr, DepositCertificateRules.Validate("PK\u0003\u0004zip"u8.ToArray(), "application/pdf", "c.pdf"));
        Assert.Equal(DepositCertificateRules.RequiredAr, DepositCertificateRules.Validate([], "application/pdf", "c.pdf"));
        Assert.Equal(1, DepositCertificateRules.PageCount(TestPdf.OnePage));
        Assert.Equal(2, DepositCertificateRules.PageCount(TestPdf.TwoPages));
    }

    [Fact]
    public void A_missing_certificate_is_required_unless_the_copy_already_holds_one()
    {
        var (_, missing) = DepositCertificateRules.Read(null, null, null, alreadyHasCertificate: false);
        Assert.Equal(DepositCertificateRules.RequiredAr, missing!["certificateContentBase64"]);

        var (bytes, none) = DepositCertificateRules.Read("  ", null, null, alreadyHasCertificate: true);
        Assert.Null(none);
        Assert.Null(bytes);

        var (_, bad) = DepositCertificateRules.Read("***", null, null, alreadyHasCertificate: false);
        Assert.Equal(DepositCertificateRules.InvalidBase64Ar, bad!["certificateContentBase64"]);
    }

    // ---- recording the deposit ----

    [Fact]
    public async Task The_code_and_the_certificate_are_both_required_for_the_final_copy()
    {
        await using var rig = await ArrangeApprovedAsync();

        var (_, noCertificate) = await rig.Service.RecordDepositAsync(
            rig.RequestId, new RegisterDepositCertificateRequest { DepositCode = "QYM-1" }, Appraiser);
        Assert.Equal(DepositCertificateRules.RequiredAr, noCertificate!["certificateContentBase64"]);

        var (_, noCode) = await rig.Service.RecordDepositAsync(
            rig.RequestId,
            new RegisterDepositCertificateRequest { DepositCode = "  ", CertificateContentBase64 = TestPdf.OnePageBase64 },
            Appraiser);
        Assert.Contains("depositCode", noCode!.Keys);

        var (_, twoPages) = await rig.Service.RecordDepositAsync(
            rig.RequestId,
            new RegisterDepositCertificateRequest
            {
                DepositCode = "QYM-1",
                CertificateContentBase64 = Convert.ToBase64String(TestPdf.TwoPages),
            },
            Appraiser);
        Assert.Equal(DepositCertificateRules.OnePageAr, twoPages!["certificateContentBase64"]);
        Assert.Null((await rig.Contexts.Valuation.ValuationReportIssuances.SingleAsync()).FinalIssuedAtUtc);
    }

    [Fact]
    public async Task Only_the_assigned_appraiser_records_the_deposit_and_only_after_the_approval()
    {
        await using var rig = await ArrangeApprovedAsync();
        var request = Certificate("QYM-2");

        var (_, specialist) = await rig.Service.RecordDepositAsync(rig.RequestId, request, Specialist);
        Assert.Equal(ValuationReportDraftService.DepositForbiddenAr, specialist![ReportDraftErrorKeys.Forbidden]);

        var other = new ReportDraftActor { UserId = "u-x", PrototypeRole = "real-estate-appraiser", DistributionAssigneeId = "val-other" };
        var (_, notAssigned) = await rig.Service.RecordDepositAsync(rig.RequestId, request, other);
        Assert.Equal(ValuationReportDraftService.DepositForbiddenAr, notAssigned![ReportDraftErrorKeys.Forbidden]);

        var (final, errors) = await rig.Service.RecordDepositAsync(rig.RequestId, request, Appraiser);
        Assert.Null(errors);
        Assert.Equal(ReportIssuanceStages.FinalIssued, final!.Stage);
        Assert.Equal("QYM-2", final.DepositCode);
    }

    [Fact]
    public async Task The_deposit_is_recorded_for_an_approved_report_only()
    {
        await using var rig = Arrange();
        // Sent but not approved: no deposit copy exists yet.
        await rig.Service.SaveChoicesAsync(
            rig.RequestId, new SaveReportDraftChoicesRequest { Choices = System.Text.Json.JsonDocument.Parse("{}").RootElement.Clone() }, Specialist);
        await rig.Service.SendAsync(rig.RequestId, new SendReportDraftRequest { ConformityConfirmed = true }, Specialist);

        var (_, errors) = await rig.Service.RecordDepositAsync(rig.RequestId, Certificate("QYM-3"), Appraiser);

        Assert.Equal(ValuationReportDraftService.NotApprovedYetAr, errors!["_"]);
    }

    [Fact]
    public async Task A_code_correction_after_the_final_issuance_keeps_the_certificate_audits_and_spends_no_version()
    {
        await using var rig = await ArrangeApprovedAsync();
        await rig.Service.RecordDepositAsync(rig.RequestId, Certificate("QYM-WRONG"), Appraiser);

        var (corrected, errors) = await rig.Service.RecordDepositAsync(
            rig.RequestId, new RegisterDepositCertificateRequest { DepositCode = "QYM-RIGHT" }, Appraiser);

        Assert.Null(errors);
        Assert.Equal("QYM-RIGHT", corrected!.DepositCode);
        Assert.Equal("certificate.pdf", corrected.CertificateFileName);
        Assert.Equal(1, corrected.Version);
        var row = await rig.Contexts.Valuation.ValuationReportIssuances.SingleAsync();
        Assert.Equal(TestPdf.OnePage, row.CertificateContent);
        var entry = Assert.Single(rig.Audit.Entries, e => e.Action == "valuation.report-issuance.code-corrected");
        Assert.Contains("QYM-WRONG", entry.BeforeJson);
        Assert.Contains("QYM-RIGHT", entry.AfterJson);
        // The delivery event was published once, by the first final issuance.
        Assert.Single(rig.Contexts.Valuation.OutboxMessages.Where(x => x.EventType == "valuation.report.submitted.v1"));
    }

    // ---- the new version ----

    [Fact]
    public async Task Only_the_specialist_reopens_a_deposited_report_and_not_before_the_code_is_recorded()
    {
        await using var rig = await ArrangeApprovedAsync();
        var request = new ReopenReportIssuanceRequest { Reason = "تغيّرت المقارنات بعد صفقة مسجلة" };

        var (_, byAppraiser) = await rig.Service.ReopenNewVersionAsync(rig.RequestId, request, Appraiser);
        Assert.Equal(ValuationReportDraftService.ReopenForbiddenAr, byAppraiser![ReportDraftErrorKeys.Forbidden]);

        // Approved but no code yet: the appraiser takes his approval back instead.
        var (_, beforeCode) = await rig.Service.ReopenNewVersionAsync(rig.RequestId, request, Specialist);
        Assert.Equal(ValuationReportIssuanceService.NoCodeYetCannotReopenAr, beforeCode!["_"]);
        Assert.Empty(rig.CaseStudy.Reopens);
    }

    [Fact]
    public async Task A_deposited_report_reopens_as_a_new_version_after_returning_the_appraisers_package()
    {
        await using var rig = await ArrangeApprovedAsync();
        await rig.Service.RecordDepositAsync(rig.RequestId, Certificate("QYM-4"), Appraiser);

        var (state, errors) = await rig.Service.ReopenNewVersionAsync(
            rig.RequestId, new ReopenReportIssuanceRequest { Reason = "تغيّرت المقارنات بعد صفقة مسجلة" }, Specialist);

        Assert.Null(errors);
        Assert.Equal(ReportIssuanceStages.Draft, state!.Stage);
        Assert.Equal(1, state.SupersededCount);
        var reopen = Assert.Single(rig.CaseStudy.Reopens);
        Assert.Equal(rig.AppraisalTaskId, reopen.TaskId);
        Assert.Contains("تغيّرت المقارنات", reopen.Reason);
        Assert.True((await rig.Contexts.Valuation.ValuationRequests.SingleAsync()).IsOpen);

        // The new cycle starts with no draft: version 2, same request (same report number).
        var next = await rig.Service.GetAsync(rig.RequestId);
        Assert.Equal("none", next!.Status);
        Assert.Equal(2, next.Version);
    }

    [Fact]
    public async Task A_refusal_from_case_study_stops_the_reopen_and_changes_nothing_here()
    {
        await using var rig = await ArrangeApprovedAsync();
        await rig.Service.RecordDepositAsync(rig.RequestId, Certificate("QYM-5"), Appraiser);
        rig.CaseStudy.Error = "تعذر إعادة فتح تقييم العقار.";

        var (result, errors) = await rig.Service.ReopenNewVersionAsync(
            rig.RequestId, new ReopenReportIssuanceRequest { Reason = "تغيّرت المقارنات بعد صفقة مسجلة" }, Specialist);

        Assert.Null(result);
        Assert.Equal(rig.CaseStudy.Error, errors!["_"]);
        var issuance = await rig.Contexts.Valuation.ValuationReportIssuances.SingleAsync();
        Assert.Null(issuance.SupersededAtUtc);
        Assert.False((await rig.Contexts.Valuation.ValuationRequests.SingleAsync()).IsOpen);
    }

    [Fact]
    public async Task A_too_short_reason_is_refused_before_case_study_is_touched()
    {
        await using var rig = await ArrangeApprovedAsync();
        await rig.Service.RecordDepositAsync(rig.RequestId, Certificate("QYM-6"), Appraiser);

        var (_, errors) = await rig.Service.ReopenNewVersionAsync(
            rig.RequestId, new ReopenReportIssuanceRequest { Reason = "  " }, Specialist);

        Assert.Contains("reason", errors!.Keys);
        Assert.Empty(rig.CaseStudy.Reopens);
    }

    [Fact]
    public async Task The_reopen_by_property_finds_the_deposited_request()
    {
        await using var rig = await ArrangeApprovedAsync();
        await rig.Service.RecordDepositAsync(rig.RequestId, Certificate("QYM-7"), Appraiser);

        var (state, errors) = await rig.Service.ReopenNewVersionByPropertyAsync(
            rig.PropertyId, new ReopenReportIssuanceRequest { Reason = "رجوع المعاملة من إنفاذ للتصحيح" }, Specialist);
        Assert.Null(errors);
        Assert.Equal(ReportIssuanceStages.Draft, state!.Stage);

        var (_, none) = await rig.Service.ReopenNewVersionByPropertyAsync(
            Guid.NewGuid(), new ReopenReportIssuanceRequest { Reason = "رجوع المعاملة من إنفاذ للتصحيح" }, Specialist);
        Assert.Equal(ValuationReportDraftService.NoDepositedRequestAr, none!["_"]);
    }

    // ---- an approved recall of a deposited report ----

    [Fact]
    public async Task An_approved_recall_of_a_deposited_report_reopens_it_as_a_new_version()
    {
        await using var rig = await ArrangeApprovedAsync();
        await rig.Service.RecordDepositAsync(rig.RequestId, Certificate("QYM-8"), Appraiser);
        var recalls = await ArrangeRecallAsync(rig);

        var (recall, errors) = await recalls.DecideAsync(
            rig.AppraisalTaskId.ToString("D"),
            new DecideEvaluatorRecallRequest { Decision = EvaluatorRecallDecisions.Approve },
            actorUserId: "u-spec");

        Assert.Null(errors);
        Assert.Equal("approved", recall!.Status);
        Assert.Single(rig.CaseStudy.Reopens);
        Assert.NotNull((await rig.Contexts.Valuation.ValuationReportIssuances.SingleAsync()).SupersededAtUtc);
        Assert.Contains(rig.Audit.Entries, e => e.Action == "valuation.report-issuance.reopened" && e.ActorId == "u-spec");
    }

    [Fact]
    public async Task A_recall_of_an_approved_report_without_a_code_asks_the_appraiser_to_withdraw_his_approval()
    {
        await using var rig = await ArrangeApprovedAsync();
        var recalls = await ArrangeRecallAsync(rig);

        var (recall, errors) = await recalls.DecideAsync(
            rig.AppraisalTaskId.ToString("D"),
            new DecideEvaluatorRecallRequest { Decision = EvaluatorRecallDecisions.Approve },
            actorUserId: "u-spec");

        Assert.Null(recall);
        Assert.Equal(EvaluatorRecallsService.DepositedRecallMessageAr, errors!["_"]);
        Assert.Empty(rig.CaseStudy.Reopens);
        Assert.Null((await rig.Contexts.Valuation.ValuationReportIssuances.SingleAsync()).SupersededAtUtc);
    }

    private static async Task<EvaluatorRecallsService> ArrangeRecallAsync(Rig rig)
    {
        var events = new ValuationOutboxPublisher(rig.Contexts.Valuation, NullLogger<ValuationOutboxPublisher>.Instance);
        var recalls = new EvaluatorRecallsService(rig.Contexts.Valuation, rig.CaseStudy, events: events, issuance: rig.Issuance);
        var (_, error) = await recalls.RequestAsync(new CreateEvaluatorRecallRequest
        {
            TaskId = rig.AppraisalTaskId.ToString("D"),
            PropertyId = rig.PropertyId.ToString("D"),
            PoNumber = "PO-N",
            Reason = "أرغب بتعديل الرأي النهائي بعد الإيداع",
        });
        Assert.Null(error);
        return recalls;
    }

    // ---- arrangement ----

    private static RegisterDepositCertificateRequest Certificate(string code) => new()
    {
        DepositCode = code,
        CertificateFileName = "certificate.pdf",
        CertificateContentType = "application/pdf",
        CertificateContentBase64 = TestPdf.OnePageBase64,
    };

    private static async Task<Rig> ArrangeApprovedAsync()
    {
        var rig = Arrange();
        var choices = System.Text.Json.JsonDocument.Parse("{}").RootElement.Clone();
        await rig.Service.SaveChoicesAsync(rig.RequestId, new SaveReportDraftChoicesRequest { Choices = choices }, Specialist);
        await rig.Service.SendAsync(rig.RequestId, new SendReportDraftRequest { ConformityConfirmed = true }, Specialist);
        var (_, errors) = await rig.Service.ApproveAsync(
            rig.RequestId, new ApproveReportDraftRequest { ReportDate = "2026-10-05", Html = "<p>report</p>" }, Appraiser);
        Assert.Null(errors);
        return rig;
    }

    private static Rig Arrange()
    {
        var contexts = TestDatabases.Create("deposit-newversion");
        var propertyId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        contexts.Valuation.ValuationRequests.Add(ValuationRequest.Create(
            requestId, "VR-N1", propertyId, "جدة", "فيلا", "مقيم", "2026-06-25", DateTime.UtcNow));
        contexts.Valuation.SaveChanges();

        var taskId = Guid.NewGuid();
        contexts.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.PropertyAppraisal, "PO-N", DateTime.UtcNow, title: "تقييم",
            phase: WorkflowTaskPhase.Done, id: taskId, propertyId: propertyId, assigneeId: AppraiserDistributionId));
        var package = PartyTaskSubmission.CreateDraft(
            taskId, WorkflowTaskKindValues.PropertyAppraisal, propertyId, "PO-N", DateTime.UtcNow);
        package.Status = PartyTaskSubmissionStatus.Submitted;
        contexts.CaseStudy.PartyTaskSubmissions.Add(package);
        contexts.CaseStudy.SaveChanges();

        var lookup = new CaseStudyLookup(contexts.CaseStudy);
        var events = new ValuationOutboxPublisher(contexts.Valuation, NullLogger<ValuationOutboxPublisher>.Instance);
        var caseStudy = new RecordingCaseStudy();
        var audit = new RecordingAuditLogAppend();
        var issuance = new ValuationReportIssuanceService(
            contexts.Valuation,
            new StubGates(),
            new StubDocuments(),
            audit: new AuditLogWriter(),
            auditLog: audit,
            events: events,
            caseStudy: lookup,
            caseStudyCommands: caseStudy);
        var service = new ValuationReportDraftService(
            contexts.Valuation, issuance, lookup, events, new FixedClock(new DateTimeOffset(2026, 10, 5, 9, 0, 0, TimeSpan.Zero)));
        return new Rig(contexts, requestId, propertyId, taskId, service, issuance, caseStudy, audit);
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class Rig(
        TestDatabases.ContextSet contexts,
        Guid requestId,
        Guid propertyId,
        Guid appraisalTaskId,
        ValuationReportDraftService service,
        ValuationReportIssuanceService issuance,
        RecordingCaseStudy caseStudy,
        RecordingAuditLogAppend audit) : IAsyncDisposable
    {
        public TestDatabases.ContextSet Contexts { get; } = contexts;
        public Guid RequestId { get; } = requestId;
        public Guid PropertyId { get; } = propertyId;
        public Guid AppraisalTaskId { get; } = appraisalTaskId;
        public ValuationReportDraftService Service { get; } = service;
        public ValuationReportIssuanceService Issuance { get; } = issuance;
        public RecordingCaseStudy CaseStudy { get; } = caseStudy;
        public RecordingAuditLogAppend Audit { get; } = audit;
        public ValueTask DisposeAsync() => Contexts.DisposeAsync();
    }

    /// <summary>Case Study's new-version reopen: records the calls, can be told to refuse.</summary>
    private sealed class RecordingCaseStudy : ICaseStudyRecallCommands
    {
        public List<(Guid TaskId, string? Reason)> Reopens { get; } = [];
        public string? Error { get; set; }

        public Task<(bool Reopened, string? Error)> ReopenAppraisalForRecallAsync(
            Guid appraisalTaskId, string? reason, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<(bool Reopened, string? Error)> ReopenAppraisalForNewVersionAsync(
            Guid appraisalTaskId, string? reason, CancellationToken cancellationToken = default)
        {
            if (Error is not null) return Task.FromResult<(bool, string?)>((false, Error));
            Reopens.Add((appraisalTaskId, reason));
            return Task.FromResult<(bool, string?)>((true, null));
        }
    }

    private sealed class StubGates : IValuationIssuanceGateService
    {
        public Task<ValuationIssuanceGatesDto?> EvaluateAsync(
            Guid valuationRequestId, CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationIssuanceGatesDto?>(new ValuationIssuanceGatesDto
            {
                ValuationRequestId = valuationRequestId, AllowsIssuance = true, BlockingReasonsAr = [],
            });
    }

    private sealed class StubDocuments : IValuationReportDocumentService
    {
        public Task<ValuationReportDocumentDto?> GetPreviewAsync(
            Guid valuationRequestId, CancellationToken cancellationToken = default) =>
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
