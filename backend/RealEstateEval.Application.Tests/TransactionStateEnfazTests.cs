using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The Enfaz handover and the specialist's way back from it: the handover names every missing
/// condition (study report issued, valuation deposited, parties complete); the return needs a
/// reason and at least one reopen choice, clears the stamp, audits and writes the timeline entry.
/// </summary>
public class TransactionStateEnfazTests
{
    private static readonly Guid WorkOrderId = Guid.Parse("d0000000-0000-0000-0000-00000000000d");
    private static readonly Guid PropertyId = Guid.Parse("d1000000-0000-0000-0000-00000000000d");
    private static readonly Guid ParentId = Guid.Parse("d2000000-0000-0000-0000-00000000000d");

    private const string Po = "PO-ENFAZ";
    private const string Reason = "ظهر خطأ في المساحة بعد الرفع";

    private static readonly CaseStudyReportActor Specialist = new()
    {
        UserId = "specialist-1",
        DisplayName = "أخصائي الدراسة",
        PrototypeRole = "case-specialist",
    };

    // ------------------------------------------------------------ handover

    [Fact]
    public async Task The_handover_names_the_missing_study_report()
    {
        await using var rig = Arrange(studyIssued: false);

        var (result, error) = await rig.Service.RecordEnfazHandoverAsync(WorkOrderId, PropertyId, "specialist-1");

        Assert.Null(result);
        Assert.StartsWith("لا يمكن رفع المعاملة على إنفاذ:", error);
        Assert.Contains("تقرير دراسة الحالة لم يُصدَر بعد", error);
        Assert.DoesNotContain("شهادة الإيداع", error);
        Assert.Null((await rig.Property()).EnfazHandoverAtUtc);
    }

    [Fact]
    public async Task The_handover_lists_every_missing_condition_in_one_text()
    {
        await using var rig = Arrange(studyIssued: false, valuationOpen: true, handedOver: false);

        var (_, error) = await rig.Service.RecordEnfazHandoverAsync(WorkOrderId, PropertyId, "specialist-1");

        Assert.Contains("تقرير دراسة الحالة لم يُصدَر بعد", error);
        Assert.Contains("شهادة الإيداع", error);
    }

    [Fact]
    public async Task The_handover_is_recorded_when_everything_is_in_place()
    {
        await using var rig = Arrange(studyIssued: true);

        var (result, error) = await rig.Service.RecordEnfazHandoverAsync(WorkOrderId, PropertyId, "specialist-1");

        Assert.Null(error);
        Assert.True(result!.StudyReportIssued);
        Assert.Empty(result.EnfazBlockReasonsAr);
        Assert.NotNull(result.EnfazHandoverAtUtc);
        var property = await rig.Property();
        Assert.NotNull(property.EnfazHandoverAtUtc);
        Assert.Equal("specialist-1", property.EnfazHandoverByUserId);
    }

    [Fact]
    public async Task The_state_exposes_the_issued_flag_and_the_block_reasons()
    {
        await using var rig = Arrange(studyIssued: false);

        var state = await rig.Service.GetStateAsync(WorkOrderId, PropertyId);

        Assert.False(state!.StudyReportIssued);
        Assert.False(state.AllowsEnfazHandover);
        Assert.Single(state.EnfazBlockReasonsAr);
        Assert.Contains("تقرير دراسة الحالة", state.EnfazBlockReasonsAr[0]);

        await using var ready = Arrange(studyIssued: true);
        var readyState = await ready.Service.GetStateAsync(WorkOrderId, PropertyId);
        Assert.True(readyState!.StudyReportIssued);
        Assert.True(readyState.AllowsEnfazHandover);
        Assert.Empty(readyState.EnfazBlockReasonsAr);
    }

    // ------------------------------------------------------------ return: gates

    [Theory]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("cdo")]
    [InlineData(null)]
    public async Task Only_the_case_specialist_takes_the_transaction_back(string? role)
    {
        await using var rig = Arrange(handedOver: true);

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason, ReopenStudy = true },
            new CaseStudyReportActor { UserId = "someone", PrototypeRole = role });

        Assert.Null(result);
        Assert.Equal(TransactionStateService.ReturnRoleDeniedAr, errors!["_"]);
        Assert.NotNull((await rig.Property()).EnfazHandoverAtUtc);
        Assert.Empty(rig.Reports.Calls);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   قصير   ")]
    public async Task The_return_needs_a_trimmed_reason_of_ten_characters(string? reason)
    {
        await using var rig = Arrange(handedOver: true);

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = reason, ReopenStudy = true },
            Specialist);

        Assert.Null(result);
        Assert.Contains("reason", errors!.Keys);
        Assert.NotNull((await rig.Property()).EnfazHandoverAtUtc);
    }

    [Fact]
    public async Task At_least_one_reopen_choice_is_required()
    {
        await using var rig = Arrange(handedOver: true);

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason },
            Specialist);

        Assert.Null(result);
        Assert.Equal(TransactionStateService.ReturnNothingChosenAr, errors!["_"]);
        Assert.NotNull((await rig.Property()).EnfazHandoverAtUtc);
    }

    [Fact]
    public async Task A_transaction_that_is_not_handed_over_has_nothing_to_take_back()
    {
        await using var rig = Arrange(handedOver: false);

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason, ReopenStudy = true },
            Specialist);

        Assert.Null(result);
        Assert.Equal(TransactionStateService.NotHandedOverAr, errors!["_"]);
        Assert.Empty(rig.Reports.Calls);
    }

    // ------------------------------------------------------------ return: effects

    [Fact]
    public async Task Returning_with_the_study_reopen_goes_through_the_report_reopen_with_the_reason()
    {
        await using var rig = Arrange(handedOver: true);

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = $"  {Reason}  ", ReopenStudy = true },
            Specialist);

        Assert.Null(errors);
        var call = Assert.Single(rig.Reports.Calls);
        Assert.Equal(ParentId, call.TaskId);
        Assert.Equal(Reason, call.Reason);
        Assert.True(call.ClearEnfazHandover);
        Assert.Equal("specialist-1", call.Actor!.UserId);
        Assert.Null((await rig.Property()).EnfazHandoverAtUtc);
        Assert.Null(result!.EnfazHandoverAtUtc);
        Assert.Contains(result.EnfazReturnNoticesAr, n => n.Contains("أُعيد فتح تقرير دراسة الحالة"));

        var audit = Assert.Single(rig.Audit.Entries, e => e.Action == "case-study.enfaz-handover.cleared");
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal(Reason, after.RootElement.GetProperty("reason").GetString());
        Assert.True(after.RootElement.GetProperty("reopenedStudy").GetBoolean());
        Assert.Equal("reopened", after.RootElement.GetProperty("study").GetString());
    }

    [Fact]
    public async Task A_refused_study_reopen_changes_nothing()
    {
        await using var rig = Arrange(handedOver: true);
        rig.Reports.Errors = new Dictionary<string, string> { ["_"] = "التقرير غير صادر — لا شيء لإعادة فتحه" };

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason, ReopenStudy = true },
            Specialist);

        Assert.Null(result);
        Assert.Equal("التقرير غير صادر — لا شيء لإعادة فتحه", errors!["_"]);
        Assert.NotNull((await rig.Property()).EnfazHandoverAtUtc);
        Assert.Empty(rig.Audit.Entries);
        Assert.Empty(await rig.Db.PropertyTimelineEntries.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task Returning_without_the_study_clears_the_stamp_audits_and_writes_the_timeline_entry()
    {
        await using var rig = Arrange(handedOver: true);

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason, ReopenValuation = true },
            Specialist);

        Assert.Null(errors);
        Assert.Empty(rig.Reports.Calls);
        var property = await rig.Property();
        Assert.Null(property.EnfazHandoverAtUtc);
        Assert.Null(property.EnfazHandoverByUserId);
        Assert.Null(result!.EnfazHandoverAtUtc);

        var audit = Assert.Single(rig.Audit.Entries, e => e.Action == "case-study.enfaz-handover.cleared");
        Assert.Equal("specialist-1", audit.ActorId);
        Assert.Equal(PropertyId.ToString("D"), audit.EntityId);
        using var before = JsonDocument.Parse(audit.BeforeJson);
        Assert.Equal("specialist-0", before.RootElement.GetProperty("by").GetString());
        Assert.NotEqual(JsonValueKind.Null, before.RootElement.GetProperty("at").ValueKind);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal("not_requested", after.RootElement.GetProperty("study").GetString());
        Assert.False(after.RootElement.GetProperty("reopenedStudy").GetBoolean());
        Assert.True(after.RootElement.GetProperty("reopenedValuation").GetBoolean());

        var entry = Assert.Single(
            await rig.Db.PropertyTimelineEntries.AsNoTracking().ToListAsync(),
            e => e.EventKey.StartsWith("enfaz_handover_returned:", StringComparison.Ordinal));
        Assert.Equal(Reason, entry.Detail);
    }

    [Fact]
    public async Task A_deposited_report_is_reopened_as_a_new_version_through_the_valuation_context()
    {
        await using var rig = Arrange(handedOver: true);

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason, ReopenValuation = true },
            Specialist);

        Assert.Null(errors);
        var call = Assert.Single(rig.ValuationReopen.Calls);
        Assert.Equal(PropertyId, call.PropertyId);
        Assert.Equal(Reason, call.Reason);
        Assert.Contains(result!.EnfazReturnNoticesAr, n => n.Contains("نسخة جديدة"));
        var audit = Assert.Single(rig.Audit.Entries);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal("reopened_new_version", after.RootElement.GetProperty("valuation").GetString());
    }

    [Fact]
    public async Task A_refusal_from_the_valuation_context_leaves_the_stamp_and_reports_the_reason()
    {
        await using var rig = Arrange(handedOver: true);
        rig.ValuationReopen.Error = "فتح تقرير التقييم بنسخة جديدة للأخصائي فقط.";

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason, ReopenValuation = true },
            Specialist);

        Assert.Null(result);
        Assert.Equal(rig.ValuationReopen.Error, errors!["_"]);
        Assert.NotNull((await rig.Property()).EnfazHandoverAtUtc);
        Assert.Empty(rig.Audit.Entries);
    }

    [Fact]
    public async Task A_report_that_is_not_deposited_is_not_sent_to_the_valuation_context()
    {
        await using var rig = Arrange(handedOver: true, valuationOpen: true);

        var (result, errors) = await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason, ReopenValuation = true },
            Specialist);

        Assert.Null(errors);
        Assert.Empty(rig.ValuationReopen.Calls);
        Assert.Contains(result!.EnfazReturnNoticesAr, n => n.Contains("غير مودَع"));
    }

    [Fact]
    public async Task After_the_return_the_transaction_can_be_handed_over_again()
    {
        await using var rig = Arrange(handedOver: true);
        await rig.Service.ReturnFromEnfazAsync(
            WorkOrderId,
            PropertyId,
            new ReturnFromEnfazRequest { Reason = Reason, ReopenValuation = true },
            Specialist);

        var (again, error) = await rig.Service.RecordEnfazHandoverAsync(WorkOrderId, PropertyId, "specialist-1");

        Assert.Null(error);
        Assert.NotNull(again!.EnfazHandoverAtUtc);
    }

    // ------------------------------------------------------------ arrangement

    private static Rig Arrange(bool studyIssued = true, bool valuationOpen = false, bool handedOver = false)
    {
        var contexts = TestDatabases.Create("enfaz-return");
        var db = contexts.CaseStudy;
        var now = DateTime.UtcNow;
        db.WorkOrders.Add(new WorkOrder
        {
            Id = WorkOrderId,
            PoNumber = Po,
            ExpectedPropertyCount = 1,
            CreatedAtUtc = now,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now),
            AssignmentType = AssignmentType.Execution,
        });
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = WorkOrderId,
            City = "جدة",
            PropertyType = "فيلا",
            Classification = "سكني",
            IdentifierType = PropertyIdentifierType.RealEstateRegistration,
            DeedKind = DeedKind.RegisteredTitle,
            DeedNumber = "1234567890",
            EnfazHandoverAtUtc = handedOver ? now : null,
            EnfazHandoverByUserId = handedOver ? "specialist-0" : null,
        });
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, Po, now, title: "دراسة",
                phase: WorkflowTaskPhase.Done, status: WorkflowTaskStatus.Completed,
                id: ParentId, propertyId: PropertyId),
            Done(WorkflowTaskKind.FieldInspection, now),
            Done(WorkflowTaskKind.PropertyAppraisal, now),
            Done(WorkflowTaskKind.EngineeringSurvey, now));
        if (studyIssued)
        {
            db.CaseStudyReports.Add(new CaseStudyReport
            {
                Id = Guid.NewGuid(),
                TaskId = ParentId,
                IsPartyContribution = false,
                PropertyId = PropertyId,
                PoNumber = Po,
                Status = CaseStudyReportStatuses.Issued,
                AnswersJson = "{}",
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }
        db.SaveChanges();

        var audit = new RecordingAuditLogAppend();
        var reports = new RecordingReports(db);
        var valuationReopen = new RecordingValuationReopen();
        var service = new TransactionStateService(
            new TransactionStateRepository(db),
            new FakeValuationRequests(valuationOpen),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
            audit: new AuditLogWriter(),
            auditLog: audit,
            caseStudyReports: reports,
            valuationReopen: valuationReopen);
        return new Rig(contexts, service, audit, reports, valuationReopen);
    }

    private static WorkflowTask Done(WorkflowTaskKind kind, DateTime now) =>
        WorkflowTask.Create(
            kind, Po, now, title: kind.ToString(), phase: WorkflowTaskPhase.Done,
            status: WorkflowTaskStatus.Completed, id: Guid.NewGuid(), propertyId: PropertyId,
            parentTaskId: ParentId);

    /// <summary>The valuation context's new-version reopen: records the calls, can be told to refuse.</summary>
    private sealed class RecordingValuationReopen : IValuationReportReopenCommands
    {
        public List<(Guid PropertyId, string Reason)> Calls { get; } = [];
        public string? Error { get; set; }

        public Task<(bool Reopened, string? Error)> ReopenDepositedReportAsync(
            Guid propertyId,
            string reason,
            CancellationToken cancellationToken = default)
        {
            Calls.Add((propertyId, reason));
            return Task.FromResult<(bool Reopened, string? Error)>(Error is null ? (true, null) : (false, Error));
        }
    }

    private sealed class Rig(
        TestDatabases.ContextSet contexts,
        TransactionStateService service,
        RecordingAuditLogAppend audit,
        RecordingReports reports,
        RecordingValuationReopen valuationReopen) : IAsyncDisposable
    {
        public TestDatabases.ContextSet Contexts { get; } = contexts;
        public CaseStudyDbContext Db => Contexts.CaseStudy;
        public TransactionStateService Service { get; } = service;
        public RecordingAuditLogAppend Audit { get; } = audit;
        public RecordingReports Reports { get; } = reports;
        public RecordingValuationReopen ValuationReopen { get; } = valuationReopen;

        public async Task<WorkOrderProperty> Property()
        {
            Db.ChangeTracker.Clear();
            return await Db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == PropertyId);
        }

        public ValueTask DisposeAsync() => Contexts.DisposeAsync();
    }

    /// <summary>The report reopen, simulated: records the call and, like the real one, clears the stamp.</summary>
    private sealed class RecordingReports(CaseStudyDbContext db) : ICaseStudyReportService
    {
        public List<(Guid TaskId, string? Reason, bool ClearEnfazHandover, CaseStudyReportActor? Actor)> Calls { get; } = [];
        public Dictionary<string, string>? Errors { get; set; }

        public async Task<(ReopenCaseStudyReportResultDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
            Guid taskId,
            string? reason,
            bool clearEnfazHandover,
            CaseStudyReportActor? actor = null,
            CancellationToken cancellationToken = default)
        {
            Calls.Add((taskId, reason, clearEnfazHandover, actor));
            if (Errors is not null) return (null, Errors);

            db.ChangeTracker.Clear();
            var property = await db.WorkOrderProperties.SingleAsync(p => p.Id == PropertyId, cancellationToken);
            var cleared = clearEnfazHandover && property.ClearEnfazHandover();
            await db.SaveChangesAsync(cancellationToken);
            return (new ReopenCaseStudyReportResultDto { EnfazHandoverCleared = cleared }, null);
        }

        public Task<CaseStudyReportDto?> GetAsync(
            Guid taskId, bool party, CaseStudyReportActor? actor = null, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
            Guid taskId, bool party, CaseStudyReportDto form, CaseStudyReportActor? actor = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> IssueAsync(
            Guid taskId, CaseStudyReportDto report, CaseStudyReportActor? actor = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }

    private sealed class FakeValuationRequests(bool open) : IValuationRequestService
    {
        public Task<ValuationRequestDto?> GetOpenByPropertyAsync(
            string propertyId, CancellationToken cancellationToken = default) =>
            Task.FromResult(open
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
                }
                : null);

        public Task<IReadOnlyList<ValuationRequestDto>> ListAsync(CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<ValuationRequestDto?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<(ValuationRequestDto? Result, string? Error)> CreateAsync(
            SaveValuationRequestRequest request, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<(ValuationRequestDto? Result, string? Error)> EnsureOpenByPropertyAsync(
            SaveValuationRequestRequest request, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<(ValuationRequestDto? Result, string? Error)> SubmitReportAsync(
            Guid id, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<(ValuationRequestDto? Result, string? Error)> RecordImpedimentAsync(
            Guid id, ValuationImpedimentRequest request, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
