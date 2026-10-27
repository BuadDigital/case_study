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
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The appraiser's hand-over is refused on the server while an issuance gate he must see fixed
/// blocks; every blocker is listed with who fixes it. The report attachments the specialist adds
/// after the hand-over (deed copy, survey document) do not hold it up. An unreadable gate fails closed.
/// </summary>
public class AppraisalHandOverGateTests
{
    private static readonly Guid Parent = Guid.Parse("c0000000-0000-0000-0000-00000000000c");
    private static readonly Guid Appraisal = Guid.Parse("c1000000-0000-0000-0000-00000000000c");
    private static readonly Guid Property = Guid.Parse("c3000000-0000-0000-0000-00000000000c");

    private static readonly PartySubmissionActor Appraiser = new()
    {
        UserId = "appraiser-user",
        DisplayName = "المقيّم",
        PrototypeRole = "real-estate-appraiser",
        DistributionAssigneeId = "dist-appraiser",
    };

    // ------------------------------------------------------------ the rule

    [Fact]
    public void Each_blocker_names_who_fixes_it_and_only_the_specialists_later_work_is_deferred()
    {
        var blockers = AppraisalHandOverGateRules.Classify(Gates(
            Failing(ValuationIssuanceGateCodes.FinalOpinion, "الرأي النهائي غير محسوب أو صفر"),
            Failing(ValuationIssuanceGateCodes.RequiredAttachments, "مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية"),
            Failing(ValuationIssuanceGateCodes.Credentials, "انتهت عضوية المقيّم"),
            Failing(ValuationIssuanceGateCodes.DeedNatureMatch, "مطابقة الصك/الطبيعة غير مكتملة"),
            Failing("comparable_weights_market", "مجموع أوزان المقارنات المعتمدة ≠ 100٪")));

        Assert.Equal(5, blockers.Count);
        Assert.Equal(AppraisalHandOverGateRules.AppraiserOwnerAr, blockers[0].OwnerAr);
        Assert.False(blockers[1].BlocksHandOver);
        Assert.Equal(AppraisalHandOverGateRules.SpecialistAfterHandOverOwnerAr, blockers[1].OwnerAr);
        Assert.Equal(AppraisalHandOverGateRules.AdministrationOwnerAr, blockers[2].OwnerAr);
        Assert.Equal(AppraisalHandOverGateRules.SpecialistOwnerAr, blockers[3].OwnerAr);
        Assert.Equal(AppraisalHandOverGateRules.AppraiserOwnerAr, blockers[4].OwnerAr);
        Assert.All(blockers.Where(b => b.Code != ValuationIssuanceGateCodes.RequiredAttachments), b => Assert.True(b.BlocksHandOver));
    }

    [Fact]
    public void The_refusal_lists_every_blocker_including_blocking_alerts_in_latin_digits()
    {
        var error = AppraisalHandOverGateRules.HandOverError(Gates(
            [Failing(ValuationIssuanceGateCodes.FinalOpinion, "الرأي النهائي غير محسوب أو صفر"),
             Failing(ValuationIssuanceGateCodes.ReconciliationWeights, "مجموع نسب المشاركة ≠ 100٪")],
            [new ValuationMethodologyAlertSnapshotItemDto { Number = 7, Code = "m7", LabelAr = "تنبيه", BlocksIssuance = true, DetailAr = "يلزم مبرر نصي" }]));

        var message = error![AppraisalHandOverGateRules.ErrorKey];
        Assert.StartsWith(AppraisalHandOverGateRules.RefusedPrefixAr, message);
        Assert.Contains("1) الرأي النهائي غير محسوب أو صفر — يعالجها: المقيّم", message);
        Assert.Contains("2) مجموع نسب المشاركة", message);
        Assert.Contains("3) يلزم مبرر نصي — يعالجها: المقيّم", message);
    }

    [Fact]
    public void Only_specialist_after_hand_over_blockers_or_passing_gates_let_the_hand_over_through()
    {
        Assert.Null(AppraisalHandOverGateRules.HandOverError(Gates(
            Failing(ValuationIssuanceGateCodes.RequiredAttachments, "صك الملكية"))));
        Assert.Null(AppraisalHandOverGateRules.HandOverError(Gates(
            new ValuationIssuanceGateSnapshotItemDto { Code = ValuationIssuanceGateCodes.FinalOpinion, Passed = true, IsHard = true })));
        Assert.Null(AppraisalHandOverGateRules.HandOverError(null));
    }

    // ------------------------------------------------------------ the submit

    [Fact]
    public async Task The_hand_over_is_refused_while_an_appraiser_gate_blocks()
    {
        await using var rig = Arrange(new GateAnswer(Gates(
            Failing(ValuationIssuanceGateCodes.FinalOpinion, "الرأي النهائي غير محسوب أو صفر"),
            Failing(ValuationIssuanceGateCodes.RequiredAttachments, "صك الملكية"))));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(result);
        var message = errors![AppraisalHandOverGateRules.ErrorKey];
        Assert.Contains("الرأي النهائي غير محسوب أو صفر", message);
        Assert.DoesNotContain("صك الملكية", message);
        Assert.Equal(
            PartyTaskSubmissionStatus.Draft,
            (await rig.Contexts.CaseStudy.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == Appraisal)).Status);
    }

    [Fact]
    public async Task Attachments_the_specialist_adds_after_the_hand_over_do_not_block_it()
    {
        await using var rig = Arrange(new GateAnswer(Gates(
            Failing(ValuationIssuanceGateCodes.RequiredAttachments, "مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية"))));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(errors);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, result!.Status);
    }

    [Fact]
    public async Task An_unreadable_gate_fails_closed()
    {
        await using var rig = Arrange(new GateAnswer(Throws: true));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(result);
        Assert.Equal(AppraisalHandOverGateRules.UnverifiedAr, errors![AppraisalHandOverGateRules.ErrorKey]);
    }

    [Fact]
    public async Task Without_an_open_valuation_request_there_is_no_gate_to_read()
    {
        await using var rig = Arrange(new GateAnswer(Open: false, Throws: true));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(errors);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, result!.Status);
    }

    [Fact]
    public async Task Before_the_study_report_is_issued_the_refusal_also_lists_what_the_appraiser_can_fix()
    {
        var answer = new GateAnswer(Gates(
            Failing(ValuationIssuanceGateCodes.StudyReportIssued, "تقرير دراسة الحالة لم يصدر"),
            Failing(ValuationIssuanceGateCodes.FinalOpinion, "الرأي النهائي غير محسوب أو صفر")));
        await using var rig = Arrange(answer, reportStatus: "draft");

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(result);
        // Round 2: one numbered list — the study report is item 1, not a sentence glued on after it.
        Assert.False(errors!.ContainsKey(PartyTaskSubmissionRules.StudyReportKey));
        var gates = errors[AppraisalHandOverGateRules.ErrorKey];
        Assert.Contains(
            $"1) {AppraisalHandOverGateRules.StudyReportNotIssuedItemAr} — يعالجها: {AppraisalHandOverGateRules.SpecialistOwnerAr}",
            gates);
        Assert.Contains("2) الرأي النهائي غير محسوب أو صفر — يعالجها: المقيّم", gates);
        Assert.DoesNotContain("تقرير دراسة الحالة لم يصدر", gates);
        Assert.DoesNotContain(PartyTaskSubmissionRules.StudyReportNotIssuedAr, gates);
        Assert.Equal(1, answer.GateReads);
    }

    [Fact]
    public async Task Before_the_study_report_is_issued_with_nothing_else_blocking_its_own_message_stays()
    {
        await using var rig = Arrange(new GateAnswer(Gates(
            Failing(ValuationIssuanceGateCodes.StudyReportIssued, "تقرير دراسة الحالة لم يصدر"))), reportStatus: "draft");

        var (_, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Equal(PartyTaskSubmissionRules.StudyReportNotIssuedAr, errors![PartyTaskSubmissionRules.StudyReportKey]);
        Assert.False(errors.ContainsKey(AppraisalHandOverGateRules.ErrorKey));
    }

    [Fact]
    public void The_weights_item_is_listed_once_when_a_weights_gate_and_alert_16_both_block()
    {
        var error = AppraisalHandOverGateRules.HandOverError(Gates(
            [Failing(ValuationIssuanceGateCodes.ReconciliationWeights, "مجموع نسب المشاركة ≠ 100٪")],
            [new ValuationMethodologyAlertSnapshotItemDto
            {
                Number = 16,
                Code = ValuationMethodologyAlertCodes.WeightsNot100,
                LabelAr = "مجموع الأوزان النسبية ≠ 100٪",
                BlocksIssuance = true,
                DetailAr = "أوزان المقارنات أو نسب مشاركة الأساليب ≠ 100٪",
            }]));

        var message = error![AppraisalHandOverGateRules.ErrorKey];
        Assert.Contains("1) مجموع نسب المشاركة ≠ 100٪", message);
        Assert.DoesNotContain("2)", message);
        Assert.DoesNotContain("أوزان المقارنات أو نسب مشاركة الأساليب", message);
    }

    [Fact]
    public async Task A_timed_out_gate_read_fails_closed_with_the_retry_message()
    {
        await using var rig = Arrange(new GateAnswer(TimesOut: true));

        var (result, errors) = await rig.Service.SubmitAsync(Appraisal, Appraiser);

        Assert.Null(result);
        Assert.Equal(AppraisalHandOverGateRules.UnverifiedAr, errors![AppraisalHandOverGateRules.ErrorKey]);
    }

    // ------------------------------------------------------------ arrangement

    private static ValuationIssuanceGateSnapshotItemDto Failing(string code, string detail) =>
        new() { Code = code, LabelAr = code, Passed = false, IsHard = true, DetailAr = detail };

    private static ValuationIssuanceGatesSnapshotDto Gates(params ValuationIssuanceGateSnapshotItemDto[] gates) =>
        Gates(gates, []);

    private static ValuationIssuanceGatesSnapshotDto Gates(
        ValuationIssuanceGateSnapshotItemDto[] gates,
        ValuationMethodologyAlertSnapshotItemDto[] alerts) => new()
    {
        AllowsIssuance = gates.All(g => g.Passed) && alerts.All(a => !a.BlocksIssuance),
        Gates = gates,
        MethodologyAlerts = alerts,
    };

    private static Rig Arrange(GateAnswer answer, string reportStatus = "issued")
    {
        var contexts = TestDatabases.Create("handover-gates");
        var db = contexts.CaseStudy;
        var now = DateTime.UtcNow;
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, "PO-HG", now, title: "دراسة",
                phase: WorkflowTaskPhase.CaseStudy, id: Parent, propertyId: Property),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal, "PO-HG", now, title: "تقييم",
                phase: WorkflowTaskPhase.Done, assigneeRole: "real-estate-appraiser",
                id: Appraisal, propertyId: Property, parentTaskId: Parent, assigneeId: "dist-appraiser"));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = Appraisal,
            Kind = WorkflowTaskKindValues.PropertyAppraisal,
            Status = PartyTaskSubmissionStatus.Draft,
            PropertyId = Property,
            PoNumber = "PO-HG",
            PayloadJson = JsonSerializer.Serialize(new { status = "draft", evaluatorPrice = "1000000" }),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.CaseStudyReports.Add(new CaseStudyReport
        {
            Id = Guid.NewGuid(),
            TaskId = Parent,
            IsPartyContribution = false,
            PropertyId = Property,
            PoNumber = "PO-HG",
            Status = reportStatus,
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

    /// <summary>The valuation port: an open request (or none) and its gates (or a failed read).</summary>
    private sealed class GateAnswer(
        ValuationIssuanceGatesSnapshotDto? gates = null,
        bool Open = true,
        bool Throws = false,
        bool TimesOut = false) : IValuationRequestService
    {
        public int GateReads { get; private set; }

        public Task<ValuationIssuanceGatesSnapshotDto?> GetIssuanceGatesAsync(
            Guid valuationRequestId,
            CancellationToken cancellationToken = default)
        {
            GateReads++;
            if (Throws) throw new HttpRequestException("valuation down");
            // HttpClient.Timeout surfaces as TaskCanceledException while the caller's token is live.
            if (TimesOut) throw new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout");
            return Task.FromResult(gates);
        }

        public Task<ValuationRequestDto?> GetOpenByPropertyAsync(
            string propertyId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationRequestDto?>(Open
                ? new ValuationRequestDto
                {
                    Id = Guid.NewGuid(),
                    DisplayId = "VR-HG",
                    PropId = propertyId,
                    Area = "جدة",
                    Type = "فيلا",
                    Appraiser = "مقيّم",
                    Status = "progress",
                    Date = "2026-10-01",
                }
                : null);

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
