using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
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
/// The appraiser's submission opens only when the specialist issued the parent's case-study
/// report: a hard block (no role bypass) with field error <c>studyReport</c>, applied to appraisal
/// packages only and only after the already-submitted early return; the same fact is exposed as
/// <c>studyReportIssued</c> on the package and on the task list.
/// </summary>
public class PartyTaskSubmissionStudyReportGateTests
{
    private static readonly Guid ParentA = Guid.Parse("a0000000-0000-0000-0000-00000000000a");
    private static readonly Guid ParentB = Guid.Parse("b0000000-0000-0000-0000-00000000000b");
    private static readonly Guid AppraisalA = Guid.Parse("a1000000-0000-0000-0000-00000000000a");
    private static readonly Guid AppraisalB = Guid.Parse("b1000000-0000-0000-0000-00000000000b");
    private static readonly Guid InspectionA = Guid.Parse("a2000000-0000-0000-0000-00000000000a");
    private static readonly Guid PropertyA = Guid.Parse("a3000000-0000-0000-0000-00000000000a");
    private static readonly Guid PropertyB = Guid.Parse("b3000000-0000-0000-0000-00000000000b");

    private static readonly PartySubmissionActor Appraiser = new()
    {
        UserId = "appraiser-user",
        DisplayName = "المقيّم",
        PrototypeRole = "real-estate-appraiser",
        DistributionAssigneeId = "dist-appraiser",
    };

    // ------------------------------------------------------------ the rule

    [Fact]
    public void The_gate_error_is_a_studyReport_field_error_and_vanishes_once_issued()
    {
        var blocked = PartyTaskSubmissionRules.StudyReportGateError(false)!;
        Assert.Equal(["studyReport"], blocked.Keys);
        Assert.Equal(PartyTaskSubmissionRules.StudyReportNotIssuedAr, blocked["studyReport"]);
        Assert.Contains("تقرير دراسة الحالة", blocked["studyReport"]);
        Assert.Null(PartyTaskSubmissionRules.StudyReportGateError(true));
    }

    // ------------------------------------------------------------ submit

    [Theory]
    [InlineData(null)]
    [InlineData("new")]
    [InlineData("draft")]
    public async Task Submit_is_blocked_until_the_report_is_issued(string? reportStatus)
    {
        await using var rig = Arrange(reportStatusA: reportStatus);

        var (result, errors) = await rig.Service.SubmitAsync(AppraisalA, Appraiser);

        Assert.Null(result);
        Assert.Equal(PartyTaskSubmissionRules.StudyReportNotIssuedAr, errors!["studyReport"]);
        Assert.Equal(
            PartyTaskSubmissionStatus.Draft,
            (await rig.Contexts.CaseStudy.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == AppraisalA)).Status);
        Assert.Equal(
            WorkflowTaskStatus.Open,
            (await rig.Contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == AppraisalA)).Status);
    }

    [Fact]
    public async Task A_reopened_report_blocks_the_submission_again()
    {
        await using var rig = Arrange(reportStatusA: "issued");
        var report = await rig.Contexts.CaseStudy.CaseStudyReports.SingleAsync(r => r.TaskId == ParentA);
        report.Status = "draft"; // what reopening does
        await rig.Contexts.CaseStudy.SaveChangesAsync();

        var (result, errors) = await rig.Service.SubmitAsync(AppraisalA, Appraiser);

        Assert.Null(result);
        Assert.True(errors!.ContainsKey("studyReport"));
    }

    [Theory]
    [InlineData("cdo")]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    public async Task No_role_bypasses_the_gate(string bypassingRole)
    {
        await using var rig = Arrange(reportStatusA: null, currentRole: bypassingRole);

        var (result, errors) = await rig.Service.SubmitAsync(AppraisalA, actor: null);

        Assert.Null(result);
        Assert.True(errors!.ContainsKey("studyReport"));
    }

    [Fact]
    public async Task Submit_succeeds_once_the_report_is_issued_and_a_repeat_submit_stays_idempotent()
    {
        await using var rig = Arrange(reportStatusA: "issued");

        var (first, firstErrors) = await rig.Service.SubmitAsync(AppraisalA, Appraiser);
        Assert.Null(firstErrors);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, first!.Status);
        Assert.True(first.StudyReportIssued);
        // The submission is a hand-over: the appraiser's task stays open until the final issuance.
        Assert.Equal(
            WorkflowTaskStatus.Open,
            (await rig.Contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == AppraisalA)).Status);

        // The specialist reopens the report afterwards: the already-submitted package must still answer OK.
        var report = await rig.Contexts.CaseStudy.CaseStudyReports.SingleAsync(r => r.TaskId == ParentA);
        report.Status = "draft";
        await rig.Contexts.CaseStudy.SaveChangesAsync();

        var (second, secondErrors) = await rig.Service.SubmitAsync(AppraisalA, Appraiser);
        Assert.Null(secondErrors);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, second!.Status);
        Assert.Equal(first.SubmittedAtUtc, second.SubmittedAtUtc);
    }

    [Fact]
    public async Task The_gate_reads_the_appraisals_own_parent_not_a_sibling_family()
    {
        // Parent A issued; appraisal B hangs off parent B, whose report is not issued.
        await using var rig = Arrange(reportStatusA: "issued", reportStatusB: "draft");

        var ok = await rig.Service.SubmitAsync(AppraisalA, Appraiser);
        var blocked = await rig.Service.SubmitAsync(
            AppraisalB,
            new PartySubmissionActor
            {
                UserId = "appraiser-b",
                DisplayName = "مقيّم آخر",
                PrototypeRole = "real-estate-appraiser",
                DistributionAssigneeId = "dist-appraiser-b",
            });

        Assert.Null(ok.Errors);
        Assert.True(blocked.Errors!.ContainsKey("studyReport"));
    }

    [Fact]
    public async Task An_appraisal_task_without_a_parent_cannot_submit()
    {
        await using var rig = Arrange(reportStatusA: "issued");
        var orphan = Guid.NewGuid();
        var now = DateTime.UtcNow;
        rig.Contexts.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.PropertyAppraisal, "PO-GATE", now, title: "يتيم",
            phase: WorkflowTaskPhase.Done, assigneeRole: "real-estate-appraiser",
            id: orphan, propertyId: PropertyA, assigneeId: "dist-appraiser"));
        rig.Contexts.CaseStudy.PartyTaskSubmissions.Add(Draft(orphan, PropertyA));
        await rig.Contexts.CaseStudy.SaveChangesAsync();

        var (result, errors) = await rig.Service.SubmitAsync(orphan, Appraiser);

        Assert.Null(result);
        Assert.True(errors!.ContainsKey("studyReport"));
    }

    // ------------------------------------------------------------ the exposed flag

    [Fact]
    public async Task The_single_read_exposes_the_flag_for_appraisal_packages_only()
    {
        await using var rig = Arrange(reportStatusA: "issued", reportStatusB: "draft");

        var issued = await rig.Service.GetAsync(AppraisalA);
        var notIssued = await rig.Service.GetAsync(AppraisalB);
        var inspection = await rig.Service.GetAsync(InspectionA);

        Assert.True(issued!.StudyReportIssued);
        Assert.False(notIssued!.StudyReportIssued);
        Assert.Null(inspection!.StudyReportIssued);
    }

    [Fact]
    public async Task The_list_read_exposes_the_flag_for_every_appraisal_package()
    {
        await using var rig = Arrange(reportStatusA: "issued", reportStatusB: "draft");

        var rows = await rig.Service.ListForTasksAsync([AppraisalA, AppraisalB, InspectionA]);

        Assert.True(rows.Single(r => r.TaskId == AppraisalA.ToString()).StudyReportIssued);
        Assert.False(rows.Single(r => r.TaskId == AppraisalB.ToString()).StudyReportIssued);
        Assert.Null(rows.Single(r => r.TaskId == InspectionA.ToString()).StudyReportIssued);
    }

    [Fact]
    public async Task The_task_list_exposes_the_flag_on_appraisal_and_parent_rows()
    {
        await using var rig = Arrange(reportStatusA: "issued", reportStatusB: null);
        var tasks = TestInspectorFeeServiceFactory.CreateWorkflow(rig.Contexts.CaseStudy);

        var rows = await tasks.ListAsync(new PermissionsDto
        {
            UserId = "staff",
            PrototypeRole = "case-specialist",
        });

        Assert.True(rows.Single(r => r.Id == AppraisalA.ToString()).StudyReportIssued);
        Assert.False(rows.Single(r => r.Id == AppraisalB.ToString()).StudyReportIssued);
        Assert.True(rows.Single(r => r.Id == ParentA.ToString()).StudyReportIssued);
        Assert.False(rows.Single(r => r.Id == ParentB.ToString()).StudyReportIssued);
        Assert.Null(rows.Single(r => r.Id == InspectionA.ToString()).StudyReportIssued);
    }

    // ------------------------------------------------------------ the hand-over

    [Fact]
    public async Task The_task_list_mirrors_the_appraisal_package_status_on_the_appraisal_and_parent_rows()
    {
        await using var rig = Arrange(reportStatusA: "issued", reportStatusB: "draft");
        await rig.Service.SubmitAsync(AppraisalA, Appraiser);
        var tasks = TestInspectorFeeServiceFactory.CreateWorkflow(rig.Contexts.CaseStudy);

        var rows = await tasks.ListAsync(new PermissionsDto { UserId = "staff", PrototypeRole = "case-specialist" });

        Assert.Equal("submitted", rows.Single(r => r.Id == AppraisalA.ToString()).AppraisalPackageStatus);
        Assert.Equal("submitted", rows.Single(r => r.Id == ParentA.ToString()).AppraisalPackageStatus);
        Assert.Equal("draft", rows.Single(r => r.Id == AppraisalB.ToString()).AppraisalPackageStatus);
        Assert.Equal("draft", rows.Single(r => r.Id == ParentB.ToString()).AppraisalPackageStatus);
        Assert.Null(rows.Single(r => r.Id == InspectionA.ToString()).AppraisalPackageStatus);
    }

    [Fact]
    public async Task After_the_final_issuance_a_plain_reopen_is_refused_and_before_it_still_works()
    {
        await using var rig = Arrange(reportStatusA: "issued", valuationOpenForProperty: false);
        await rig.Service.SubmitAsync(AppraisalA, Appraiser);
        // Final issuance: the delivery event completes the appraiser's task and the request is closed.
        var task = await rig.Contexts.CaseStudy.WorkflowTasks.SingleAsync(t => t.Id == AppraisalA);
        task.Complete(DateTime.UtcNow);
        await rig.Contexts.CaseStudy.SaveChangesAsync();

        var (result, errors) = await rig.Service.ReopenAsync(
            AppraisalA,
            new ReopenPartyTaskSubmissionRequest { ReturnNote = "تصحيح بعد الإصدار" },
            new PartySubmissionActor { UserId = "s", DisplayName = "أخصائي", PrototypeRole = "case-specialist" });

        Assert.Null(result);
        Assert.Equal(PartyTaskSubmissionService.AppraisalFinalIssuedReopenForbiddenAr, errors!["_"]);
        Assert.Equal(
            PartyTaskSubmissionStatus.Submitted,
            (await rig.Contexts.CaseStudy.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == AppraisalA)).Status);
    }

    [Fact]
    public async Task A_legacy_completed_task_whose_request_is_still_open_stays_reopenable()
    {
        await using var rig = Arrange(reportStatusA: "issued", valuationOpenForProperty: true);
        await rig.Service.SubmitAsync(AppraisalA, Appraiser);
        var task = await rig.Contexts.CaseStudy.WorkflowTasks.SingleAsync(t => t.Id == AppraisalA);
        task.Complete(DateTime.UtcNow);
        await rig.Contexts.CaseStudy.SaveChangesAsync();

        var (result, errors) = await rig.Service.ReopenAsync(
            AppraisalA,
            new ReopenPartyTaskSubmissionRequest { ReturnNote = "تصحيح قبل الإيداع" },
            new PartySubmissionActor { UserId = "s", DisplayName = "أخصائي", PrototypeRole = "case-specialist" });

        Assert.Null(errors);
        Assert.Equal(PartyTaskSubmissionStatus.Reopened, result!.Status);
    }

    [Fact]
    public async Task While_the_report_is_approved_the_package_is_not_returned_until_the_approval_is_withdrawn()
    {
        await using var rig = Arrange(
            reportStatusA: "issued", valuationOpenForProperty: true, valuationReportStage: "deposit_issued");
        await rig.Service.SubmitAsync(AppraisalA, Appraiser);

        var (result, errors) = await rig.Service.ReopenAsync(
            AppraisalA,
            new ReopenPartyTaskSubmissionRequest { ReturnNote = "تصحيح" },
            new PartySubmissionActor { UserId = "s", DisplayName = "أخصائي", PrototypeRole = "case-specialist" });

        Assert.Null(result);
        Assert.Equal(PartyTaskSubmissionService.AppraisalReportApprovedReopenForbiddenAr, errors!["_"]);
        Assert.Equal(
            PartyTaskSubmissionStatus.Submitted,
            (await rig.Contexts.CaseStudy.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == AppraisalA)).Status);
    }

    // ------------------------------------------------------------ the new version (n+1)

    [Fact]
    public async Task The_specialist_reopens_a_completed_appraisal_as_a_new_version()
    {
        await using var rig = Arrange(reportStatusA: "issued", valuationOpenForProperty: false);
        await rig.Service.SubmitAsync(AppraisalA, Appraiser);
        var task = await rig.Contexts.CaseStudy.WorkflowTasks.SingleAsync(t => t.Id == AppraisalA);
        task.Complete(DateTime.UtcNow);
        await rig.Contexts.CaseStudy.SaveChangesAsync();

        var (result, errors) = await rig.Service.ReopenForNewVersionAsync(
            AppraisalA,
            new ReopenForNewVersionRequest { Reason = "تغيّرت المقارنات بعد صفقة مسجلة" },
            new PartySubmissionActor { UserId = "s", DisplayName = "أخصائي", PrototypeRole = "case-specialist" });

        Assert.Null(errors);
        Assert.Equal(PartyTaskSubmissionStatus.Reopened, result!.Status);
        Assert.Equal(
            WorkflowTaskStatus.Open,
            (await rig.Contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == AppraisalA)).Status);
    }

    [Fact]
    public async Task The_new_version_reopen_is_the_specialists_alone()
    {
        await using var rig = Arrange(reportStatusA: "issued");
        await rig.Service.SubmitAsync(AppraisalA, Appraiser);

        foreach (var role in new[] { "section-supervisor", "cdo", "general-manager", "real-estate-appraiser" })
        {
            var (result, errors) = await rig.Service.ReopenForNewVersionAsync(
                AppraisalA,
                new ReopenForNewVersionRequest { Reason = "سبب" },
                new PartySubmissionActor { UserId = "x", PrototypeRole = role });
            Assert.Null(result);
            Assert.Equal(PartyTaskSubmissionService.NewVersionForbiddenAr, errors!["_"]);
        }
    }

    [Fact]
    public async Task A_retried_new_version_reopen_only_makes_sure_the_task_is_open()
    {
        await using var rig = Arrange(reportStatusA: "issued");
        await rig.Service.SubmitAsync(AppraisalA, Appraiser);
        var specialist = new PartySubmissionActor { UserId = "s", DisplayName = "أخصائي", PrototypeRole = "case-specialist" };

        // A partial state from an interrupted first attempt: the package is already returned but the task is completed.
        var package = await rig.Contexts.CaseStudy.PartyTaskSubmissions.SingleAsync(s => s.WorkflowTaskId == AppraisalA);
        package.Status = PartyTaskSubmissionStatus.Reopened;
        var task = await rig.Contexts.CaseStudy.WorkflowTasks.SingleAsync(t => t.Id == AppraisalA);
        task.Complete(DateTime.UtcNow);
        await rig.Contexts.CaseStudy.SaveChangesAsync();

        var (result, errors) = await rig.Service.ReopenForNewVersionAsync(
            AppraisalA, new ReopenForNewVersionRequest { Reason = "تغيّرت المقارنات بعد صفقة مسجلة" }, specialist);

        Assert.Null(errors);
        Assert.Equal(PartyTaskSubmissionStatus.Reopened, result!.Status);
        Assert.Equal(
            WorkflowTaskStatus.Open,
            (await rig.Contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == AppraisalA)).Status);
    }

    [Fact]
    public async Task The_staff_cannot_edit_a_submitted_appraisal_package()
    {
        await using var rig = Arrange(reportStatusA: "issued");
        await rig.Service.SubmitAsync(AppraisalA, Appraiser);

        var (result, errors) = await rig.Service.SaveDraftAsync(
            AppraisalA,
            new SavePartyTaskSubmissionRequest { Payload = JsonDocument.Parse("{\"evaluatorPrice\":\"1\"}").RootElement.Clone() },
            new PartySubmissionActor { UserId = "s", DisplayName = "أخصائي", PrototypeRole = "case-specialist" });

        Assert.Null(result);
        Assert.NotNull(errors);
    }

    // ------------------------------------------------------------ arrangement

    private static PartyTaskSubmission Draft(Guid taskId, Guid propertyId) => new()
    {
        Id = Guid.NewGuid(),
        WorkflowTaskId = taskId,
        Kind = WorkflowTaskKindValues.PropertyAppraisal,
        Status = PartyTaskSubmissionStatus.Draft,
        PropertyId = propertyId,
        PoNumber = "PO-GATE",
        PayloadJson = JsonSerializer.Serialize(new { status = "draft", evaluatorPrice = "1000000" }),
        CreatedAtUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow,
    };

    private static Rig Arrange(
        string? reportStatusA,
        string? reportStatusB = "draft",
        string? currentRole = null,
        bool? valuationOpenForProperty = null,
        string? valuationReportStage = null)
    {
        var contexts = TestDatabases.Create("study-report-gate");
        var db = contexts.CaseStudy;
        var now = DateTime.UtcNow;

        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, "PO-GATE", now, title: "دراسة أ",
                phase: WorkflowTaskPhase.CaseStudy, id: ParentA, propertyId: PropertyA),
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, "PO-GATE", now, title: "دراسة ب",
                phase: WorkflowTaskPhase.CaseStudy, id: ParentB, propertyId: PropertyB),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal, "PO-GATE", now, title: "تقييم أ",
                phase: WorkflowTaskPhase.Done, assigneeRole: "real-estate-appraiser",
                id: AppraisalA, propertyId: PropertyA, parentTaskId: ParentA,
                assigneeId: "dist-appraiser"),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal, "PO-GATE", now, title: "تقييم ب",
                phase: WorkflowTaskPhase.Done, assigneeRole: "real-estate-appraiser",
                id: AppraisalB, propertyId: PropertyB, parentTaskId: ParentB,
                assigneeId: "dist-appraiser-b"),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection, "PO-GATE", now, title: "معاينة أ",
                phase: WorkflowTaskPhase.Done, assigneeRole: "field-inspector",
                id: InspectionA, propertyId: PropertyA, parentTaskId: ParentA,
                assigneeId: "dist-inspector"));
        db.PartyTaskSubmissions.AddRange(
            Draft(AppraisalA, PropertyA),
            Draft(AppraisalB, PropertyB),
            new PartyTaskSubmission
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = InspectionA,
                Kind = WorkflowTaskKindValues.FieldInspection,
                Status = PartyTaskSubmissionStatus.Draft,
                PropertyId = PropertyA,
                PoNumber = "PO-GATE",
                PayloadJson = "{}",
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        if (reportStatusA is not null)
            db.CaseStudyReports.Add(Report(ParentA, PropertyA, reportStatusA));
        if (reportStatusB is not null)
            db.CaseStudyReports.Add(Report(ParentB, PropertyB, reportStatusB));
        db.SaveChanges();

        var failures = TestInspectorFeeServiceFactory.ShareFailures(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        var service = new PartyTaskSubmissionService(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(failures)),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
            new FixedRole(currentRole),
            TestInspectorFeeServiceFactory.Create(db),
            notifications,
            recipients,
            new AuditLogWriter(),
            new RecordingAuditLogAppend(),
            valuationRequests: valuationOpenForProperty is { } open ? new StubValuationRequests(open, valuationReportStage) : null);
        return new Rig(contexts, service);
    }

    /// <summary>Only the open-request read matters here: a closed request means the final issuance happened.</summary>
    private sealed class StubValuationRequests(bool openForProperty, string? reportStage = null) : IValuationRequestService
    {
        public Task<IReadOnlyList<ValuationRequestDto>> ListAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ValuationRequestDto>>([]);

        public Task<ValuationRequestDto?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationRequestDto?>(null);

        public Task<ValuationRequestDto?> GetOpenByPropertyAsync(
            string propertyId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationRequestDto?>(openForProperty
                ? new ValuationRequestDto
                {
                    Id = Guid.NewGuid(),
                    DisplayId = "VR-1",
                    PropId = propertyId,
                    Area = "جدة",
                    Type = "فيلا",
                    Appraiser = "مقيّم",
                    Status = "progress",
                    Date = "2026-09-01",
                    ReportStage = reportStage,
                }
                : null);

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

    private static CaseStudyReport Report(Guid parentTaskId, Guid propertyId, string status) => new()
    {
        Id = Guid.NewGuid(),
        TaskId = parentTaskId,
        IsPartyContribution = false,
        PropertyId = propertyId,
        PoNumber = "PO-GATE",
        Status = status,
        AnswersJson = "{}",
        CreatedAtUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow,
    };

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
