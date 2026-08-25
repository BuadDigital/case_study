using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class GodServiceCollaboratorTests
{
    [Theory]
    [InlineData(OperationsTaskStatus.Created, OperationsTaskStatus.InProgress, "a1", "field-inspector", null)]
    [InlineData(OperationsTaskStatus.InProgress, OperationsTaskStatus.Completed, "a1", "field-inspector", null)]
    [InlineData(OperationsTaskStatus.Created, OperationsTaskStatus.Paused, "a1", "case-specialist", null)]
    [InlineData(OperationsTaskStatus.Created, OperationsTaskStatus.Completed, "a1", "field-inspector", "انتقال حالة غير مسموح")]
    [InlineData(OperationsTaskStatus.Completed, OperationsTaskStatus.InProgress, "a1", "case-specialist", "المهمة في حالة نهائية")]
    public void Operations_status_transitions(
        OperationsTaskStatus from,
        OperationsTaskStatus to,
        string actorAssignee,
        string role,
        string? expectedError)
    {
        var entity = OperationsTaskInStatus(from);

        var error = OperationsTaskLifecycleRules.ValidateStatusTransition(
            entity, to, actorAssignee, role);
        Assert.Equal(expectedError, error);
    }

    [Fact]
    public void Operations_manager_roles_match_legacy()
    {
        Assert.True(OperationsTaskLifecycleRules.IsManager("case-specialist"));
        Assert.True(OperationsTaskLifecycleRules.IsManager("section-supervisor"));
        Assert.True(OperationsTaskLifecycleRules.IsManager("CDO"));
        Assert.False(OperationsTaskLifecycleRules.IsManager("field-inspector"));
    }

    [Fact]
    public void Operations_assignee_may_pause_only_for_active_failure()
    {
        var entity = OperationsTaskInStatus(OperationsTaskStatus.InProgress);

        Assert.Equal(
            "هذا الإجراء للمنشئ أو المشرف فقط",
            OperationsTaskLifecycleRules.ValidateStatusTransition(
                entity,
                OperationsTaskStatus.Paused,
                "a1",
                "government-reviewer",
                pauseReason: "ظرف طارئ"));

        Assert.Null(
            OperationsTaskLifecycleRules.ValidateStatusTransition(
                entity,
                OperationsTaskStatus.Paused,
                "a1",
                "government-reviewer",
                pauseReason: "تعذر نشط — بانتظار حل الأخصائي/المشرف"));
    }

    [Fact]
    public void Operations_assignee_may_reopen_to_created_after_failure_pause()
    {
        var entity = OperationsTaskInStatus(OperationsTaskStatus.InProgress);
        entity.TransitionTo(
            OperationsTaskStatus.Paused,
            DateTime.UtcNow,
            pauseReason: "تعذر نشط — بانتظار حل الأخصائي/المشرف");

        Assert.Null(
            OperationsTaskLifecycleRules.ValidateStatusTransition(
                entity,
                OperationsTaskStatus.Created,
                "a1",
                "government-reviewer"));

        Assert.Null(
            OperationsTaskLifecycleRules.ValidateStatusTransition(
                entity,
                OperationsTaskStatus.Created,
                "other",
                "case-specialist"));

        Assert.Equal(
            "هذا الإجراء للمنفّذ المكلّف أو المشرف فقط",
            OperationsTaskLifecycleRules.ValidateStatusTransition(
                entity,
                OperationsTaskStatus.Created,
                "other",
                "field-inspector"));
    }

    [Fact]
    public void Court_visit_normalize_requires_contacts_for_other_party()
    {
        var (_, error) = OperationsTaskCourtVisitRules.Normalize(new OperationsTaskCourtVisitResultDto
        {
            Kind = "other_party",
        });
        Assert.Equal("يلزم إدخال جهة اتصال واحدة على الأقل عندما يكون الظرف عند طرف آخر", error);
    }

    [Theory]
    [InlineData(WorkflowTaskStatus.Completed, "done")]
    [InlineData(WorkflowTaskStatus.Cancelled, "cancelled")]
    [InlineData(WorkflowTaskStatus.Open, "in_progress")]
    public void Inspector_fee_work_status_from_task(WorkflowTaskStatus taskStatus, string expected)
    {
        var task = FieldInspectionTask(Guid.NewGuid(), "t", taskStatus);

        var status = InspectorFeeWorkStatusRules.ResolveWorkStatus(
            task,
            new Dictionary<Guid, FieldInspectionWorkspace>(),
            new Dictionary<Guid, PartyTaskSubmission>());
        Assert.Equal(expected, status);
    }

    [Fact]
    public void Inspector_fee_work_status_uses_submitted_workspace()
    {
        var id = Guid.NewGuid();
        var task = FieldInspectionTask(id, "t", WorkflowTaskStatus.Open);
        var workspaces = new Dictionary<Guid, FieldInspectionWorkspace>
        {
            [id] = new FieldInspectionWorkspace
            {
                WorkflowTaskId = id,
                PartyTaskSubmissionId = Guid.NewGuid(),
                Status = PartyTaskSubmissionStatus.Submitted,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            },
        };

        Assert.Equal(
            "done",
            InspectorFeeWorkStatusRules.ResolveWorkStatus(
                task, workspaces, new Dictionary<Guid, PartyTaskSubmission>()));
    }

    [Fact]
    public void Inspector_fee_transition_auth_requires_matching_assignee()
    {
        var ledger = new InspectorFeeLedger
        {
            WorkflowTaskId = Guid.NewGuid(),
            PoNumber = "PO-1",
            AssigneeId = "party-1",
            InspectorType = InspectorFeeRules.TypeEmployee,
            BillingStatus = InspectorFeeBillingStatus.Draft,
            AccruedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        Assert.True(InspectorFeeTransitionAuthorization.CanPerformAction(
            InspectorFeeActions.SubmitToSupervisor, ledger, "party-1", false, false));
        Assert.False(InspectorFeeTransitionAuthorization.CanPerformAction(
            InspectorFeeActions.SubmitToSupervisor, ledger, "other", false, false));
        Assert.True(InspectorFeeTransitionAuthorization.CanPerformAction(
            InspectorFeeActions.ApproveToFinance, ledger, null, true, false));
        Assert.True(InspectorFeeTransitionAuthorization.CanPerformAction(
            InspectorFeeActions.Disburse, ledger, null, false, true));
    }

    [Fact]
    public void Inspector_fee_stable_transaction_key_is_deterministic()
    {
        var a = RealEstateEval.Infrastructure.Services.InspectorFeeLedgerResolver
            .StableGuidFromKey("tx:PO-orphan");
        var b = RealEstateEval.Infrastructure.Services.InspectorFeeLedgerResolver
            .StableGuidFromKey("tx:PO-orphan");
        var c = RealEstateEval.Infrastructure.Services.InspectorFeeLedgerResolver
            .StableGuidFromKey("tx:PO-other");

        Assert.Equal(a, b);
        Assert.NotEqual(a, c);
    }

    [Fact]
    public void Key_envelope_handoff_status_and_scenario()
    {
        var entity = new KeyEnvelope
        {
            Id = Guid.NewGuid(),
            RequestNumber = "R1",
            Court = "c",
            Circuit = "1",
            Status = KeyEnvelopeStatuses.Reviewer,
            ReceiveScenario = KeyReceiveScenarios.Court,
            CreatedByUserId = "u",
            CreatedByName = "n",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        KeyEnvelopeLifecycleRules.ApplyHandoffStatus(entity, KeyHandoffKinds.External);
        Assert.Equal(KeyEnvelopeStatuses.External, entity.Status);
        Assert.Equal(KeyReceiveScenarios.Missing, KeyEnvelopeLifecycleRules.NormalizeScenario("missing"));
        Assert.Equal(KeyReceiveScenarios.Court, KeyEnvelopeLifecycleRules.NormalizeScenario("bogus"));
    }

    [Fact]
    public void Party_submission_validate_engineering_survey_requires_coords()
    {
        var entity = new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = Guid.NewGuid(),
            Kind = "engineering-survey",
            Status = PartyTaskSubmissionStatus.Draft,
            PayloadJson = """{"siteConfirmed":true,"surveyReportFileName":"a.pdf","siteLetterFileName":"b.pdf"}""",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        var errors = PartyTaskSubmissionPayloadRules.ValidateForSubmit(entity);
        Assert.True(errors.ContainsKey("coordinates"));
        Assert.DoesNotContain("siteLetterFileName", errors.Keys);
    }

    [Fact]
    public void Site_letter_is_optional_when_property_has_plan_and_plot()
    {
        using var doc = JsonDocument.Parse("""{"siteLetterFileName":""}""");
        var waived = new Dictionary<string, string>();
        PartyTaskSubmissionPayloadRules.RequireSiteLetterUnlessPlatted(
            waived, doc.RootElement, "1234", "56");
        Assert.Empty(waived);

        var required = new Dictionary<string, string>();
        PartyTaskSubmissionPayloadRules.RequireSiteLetterUnlessPlatted(
            required, doc.RootElement, "1234", "");
        Assert.Equal("خطاب الموقع مطلوب", required["siteLetterFileName"]);
    }

    [Fact]
    public void Workflow_phase_after_enfath()
    {
        Assert.Equal(
            WorkflowTaskPhase.Distribution,
            WorkflowTaskPhaseRules.PhaseAfterEnfath(
                PropertyIdentifierTypeLabels.RealEstateReg, false));
        Assert.Equal(
            WorkflowTaskPhase.Distribution,
            WorkflowTaskPhaseRules.PhaseAfterEnfath("deed", true));
        Assert.Equal(
            WorkflowTaskPhase.Bourse,
            WorkflowTaskPhaseRules.PhaseAfterEnfath("deed", false));
    }

    [Fact]
    public void Workflow_visibility_hides_foreign_assignee()
    {
        var filter = new RealEstateEval.Infrastructure.Services.WorkflowTaskVisibilityFilter();
        var tasks = new[]
        {
            FieldInspectionTask(Guid.NewGuid(), "mine", WorkflowTaskStatus.Open, assigneeId: "me"),
            FieldInspectionTask(Guid.NewGuid(), "theirs", WorkflowTaskStatus.Open, assigneeId: "them"),
        }.AsQueryable();

        var visible = filter.VisibleTaskQuery(tasks, new PermissionsDto
        {
            UserId = "u1",
            PrototypeRole = "field-inspector",
            DistributionAssigneeId = "me",
        }).ToList();

        Assert.Single(visible);
        Assert.Equal("me", visible[0].AssigneeId);
    }

    private static WorkflowTask FieldInspectionTask(
        Guid id,
        string title,
        WorkflowTaskStatus status,
        string? assigneeId = null) =>
        WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            poNumber: "PO-1",
            nowUtc: DateTime.UtcNow,
            title: title,
            phase: WorkflowTaskPhase.Done,
            status: status,
            assigneeRole: "field-inspector",
            id: id,
            assigneeId: assigneeId);

 /// <summary>
 /// Walks a fresh task through the real transitions to reach <paramref name="status"/>; the
 /// aggregate has no back door, and the path itself is part of what the rules assume.
 /// </summary>
    private static OperationsTask OperationsTaskInStatus(OperationsTaskStatus status)
    {
        var now = DateTime.UtcNow;
        var entity = OperationsTask.Create(
            Guid.NewGuid(),
            "T-1",
            OperationsTaskType.General,
            "t",
            OperationsTaskScope.General,
            assigneeId: "a1",
            createdBy: "c1",
            priority: OperationsTaskPriority.Medium,
            dueAtUtc: now.AddHours(12),
            nowUtc: now,
            assigneeName: "A",
            createdByName: "C");

        OperationsTaskStatus[] path = status switch
        {
            OperationsTaskStatus.Created => [],
            OperationsTaskStatus.InProgress => [OperationsTaskStatus.InProgress],
            OperationsTaskStatus.Paused => [OperationsTaskStatus.Paused],
            OperationsTaskStatus.Completed =>
                [OperationsTaskStatus.InProgress, OperationsTaskStatus.Completed],
            OperationsTaskStatus.Cancelled => [OperationsTaskStatus.Cancelled],
            _ => throw new ArgumentOutOfRangeException(nameof(status)),
        };

        foreach (var step in path)
            entity.TransitionTo(step, now, pauseReason: "سبب", cancelReason: "سبب");

        return entity;
    }
}
