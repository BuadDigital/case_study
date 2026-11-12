using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Application.Services;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Failures.Infrastructure.Persistence;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// «التعذر النهائي عن المعاملة»: the supervisor's final failure lands on every live deed of the
/// transaction — the escalated failure is finalized, a deed without one gets one filed — the deeds
/// stop, and the parties hear about it only when the supervisor asks. And its way back: coordination
/// takes it back when Enfaz returns the transaction, and the work goes on.
/// </summary>
public sealed class FinalFailureTests
{
    private const string Po = "PO-FINAL";
    private const string Reason = "قرار المركز: الصك موقوف لدى المحكمة";

    [Fact]
    public async Task The_final_failure_stops_every_deed_of_the_transaction_and_tells_the_parties()
    {
        await using var rig = Arrange();
        var escalated = PropertyFailure.Create(
            Guid.NewGuid(), Po, rig.DeedA, "1001", "تداخل حدود", "boundary-overlap",
            PropertyFailureSeverity.Internal, "الأخصائي", "", "أسامة", DateTime.UtcNow);
        escalated.TrySubmitForReview("لم يُحل مع الملاك", DateTime.UtcNow);
        rig.Bundle.Failures.PropertyFailures.Add(escalated);
        await rig.Bundle.Failures.SaveChangesAsync();

        var (result, errors) = await rig.Service.RecordFinalFailureAsync(new FinalFailureRequest
        {
            PoNumber = Po,
            PropertyId = rig.DeedA.ToString("D"),
            ProblemTypeId = "court-hold",
            Title = "حجز قضائي",
            Reason = Reason,
            NotifyParties = true,
        }, "supervisor-1");

        Assert.Null(errors);
        Assert.Equal(2, result!.Count);
        Assert.All(result, f => Assert.Equal(PropertyFailureStatus.Approved, f.Status));
        Assert.All(result, f => Assert.Equal(Reason, f.FinalNote));
        Assert.Contains(result, f => f.Id == escalated.Id.ToString());
        var filed = Assert.Single(result, f => f.PropertyId == rig.DeedB.ToString("D"));
        Assert.Equal("court-hold", filed.ProblemTypeId);
        Assert.Equal(FailureRecordRules.SupervisorRaiserRole, filed.RaisedByRole);

        var deeds = await rig.Bundle.CaseStudy.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == rig.DeedA || p.Id == rig.DeedB)
            .ToListAsync();
        Assert.All(deeds, d => Assert.Equal(FailureRecordRules.DeedStatusSuspended, d.DeedStatus));
        var survey = await rig.Bundle.CaseStudy.WorkflowTasks.AsNoTracking()
            .SingleAsync(t => t.Kind == WorkflowTaskKind.EngineeringSurvey);
        Assert.Equal(WorkflowTaskStatus.Blocked, survey.Status);

        var partyNotice = Assert.Single(rig.Notifications.Sent, n => n.Title == "تعذّر نهائي عن المعاملة");
        Assert.Contains(Reason, partyNotice.Body);
        Assert.Contains("user-office", rig.Notifications.Recipients);
    }

    [Fact]
    public async Task Without_notifying_the_parties_their_tasks_stop_silently()
    {
        await using var rig = Arrange();

        var (_, errors) = await rig.Service.RecordFinalFailureAsync(new FinalFailureRequest
        {
            PoNumber = Po,
            PropertyId = rig.DeedB.ToString("D"),
            ProblemTypeId = "court-hold",
            Reason = Reason,
            NotifyParties = false,
        });

        Assert.Null(errors);
        Assert.DoesNotContain(rig.Notifications.Sent, n => n.Title == "تعذّر نهائي عن المعاملة");
        var survey = await rig.Bundle.CaseStudy.WorkflowTasks.AsNoTracking()
            .SingleAsync(t => t.Kind == WorkflowTaskKind.EngineeringSurvey);
        Assert.Equal(WorkflowTaskStatus.Blocked, survey.Status);
    }

    [Fact]
    public async Task A_deed_without_an_open_failure_needs_a_problem_type_and_a_reason_is_always_required()
    {
        await using var rig = Arrange();

        var (_, noType) = await rig.Service.RecordFinalFailureAsync(new FinalFailureRequest
        {
            PoNumber = Po,
            PropertyId = rig.DeedA.ToString("D"),
            Reason = Reason,
        });
        Assert.True(noType!.ContainsKey("problemTypeId"));

        var (_, noReason) = await rig.Service.RecordFinalFailureAsync(new FinalFailureRequest
        {
            PoNumber = Po,
            PropertyId = rig.DeedA.ToString("D"),
            ProblemTypeId = "court-hold",
            Reason = "  ",
        });
        Assert.True(noReason!.ContainsKey("reason"));
        Assert.Empty(await rig.Bundle.Failures.PropertyFailures.ToListAsync());
    }

    [Fact]
    public async Task A_transaction_already_final_is_not_finalized_twice()
    {
        await using var rig = Arrange();
        var request = new FinalFailureRequest
        {
            PoNumber = Po,
            PropertyId = rig.DeedA.ToString("D"),
            ProblemTypeId = "court-hold",
            Reason = Reason,
        };
        await rig.Service.RecordFinalFailureAsync(request);

        var (result, errors) = await rig.Service.RecordFinalFailureAsync(request);

        Assert.Null(result);
        Assert.True(errors!.ContainsKey("propertyId"));
    }

    [Fact]
    public async Task A_final_failure_filed_by_the_case_specialist_is_raised_under_his_label()
    {
        await using var rig = Arrange();

        var (result, errors) = await rig.Service.RecordFinalFailureAsync(new FinalFailureRequest
        {
            PoNumber = Po,
            PropertyId = rig.DeedA.ToString("D"),
            ProblemTypeId = "court-hold",
            Reason = Reason,
            RaisedByRole = FailureRecordRules.FinalFailureRaiserRole("case-specialist"),
        });

        Assert.Null(errors);
        Assert.All(result!, f => Assert.Equal(FailureRecordRules.SpecialistRaiserRole, f.RaisedByRole));
    }

    /// <summary>Omar 2026-11-11: the case specialist records the final failure too; the parties and the general manager never do.</summary>
    [Theory]
    [InlineData("section-supervisor", true)]
    [InlineData("cdo", true)]
    [InlineData("case-specialist", true)]
    [InlineData("Case-Specialist", true)]
    [InlineData("general-manager", false)]
    [InlineData("field-inspector", false)]
    [InlineData("engineering-office", false)]
    [InlineData("real-estate-appraiser", false)]
    [InlineData(null, false)]
    public void The_case_specialist_and_the_supervisor_record_the_final_failure(string? role, bool allowed) =>
        Assert.Equal(allowed, FailureRecordRules.CanRecordFinalFailure(role));

    /// <summary>
    /// Omar 2026-11-11: «تعذّر داخلي» is the case specialist's and the supervisor's; every other role's
    /// raise is recorded «تعذّر محتمل», whatever it asked for.
    /// </summary>
    [Theory]
    [InlineData("case-specialist", "internal", "internal")]
    [InlineData("case-specialist", "suspected", "suspected")]
    [InlineData("section-supervisor", "internal", "internal")]
    [InlineData("cdo", "internal", "internal")]
    [InlineData("field-inspector", "internal", "suspected")]
    [InlineData("engineering-office", "internal", "suspected")]
    [InlineData("real-estate-appraiser", "internal", "suspected")]
    [InlineData("real-estate-appraiser", "suspected", "suspected")]
    [InlineData("general-manager", "internal", "suspected")]
    [InlineData(null, "internal", "suspected")]
    public void A_raise_is_recorded_with_the_severity_its_role_may_file(
        string? role, string requested, string expected) =>
        Assert.Equal(
            expected,
            FailureRules.NormalizeSeverity(FailureRecordRules.RaiseSeverityFor(role, requested)));

    [Theory]
    [InlineData("case-specialist", FailureRecordRules.SpecialistRaiserRole)]
    [InlineData("section-supervisor", FailureRecordRules.SupervisorRaiserRole)]
    [InlineData("cdo", FailureRecordRules.SupervisorRaiserRole)]
    public void The_final_failure_names_who_filed_it(string role, string expected) =>
        Assert.Equal(expected, FailureRecordRules.FinalFailureRaiserRole(role));

    // ---- «الرجوع من التعذّر النهائي» (Omar 2026-11-12) ----

    private const string BackReason = "اتصال مركز التصفية: رجعت المعاملة من التعذّر في إنفاذ";

    private static readonly StaffActor Coordinator =
        new(StaffRoleIds.CaseSpecialist, [CaseSpecialistSubRoles.Coordination]);

    private static FinalFailureRequest FinalOn(Guid deed) => new()
    {
        PoNumber = Po,
        PropertyId = deed.ToString("D"),
        ProblemTypeId = "court-hold",
        Reason = Reason,
    };

    private static RevertFinalFailureRequest BackOn(Guid deed, string reason = BackReason) => new()
    {
        PoNumber = Po,
        PropertyId = deed.ToString("D"),
        Reason = reason,
    };

    [Fact]
    public async Task Coming_back_from_the_final_failure_reopens_every_deed_and_tells_the_parties()
    {
        await using var rig = Arrange();
        await rig.Service.RecordFinalFailureAsync(FinalOn(rig.DeedA));

        // Asked from the sibling deed: the whole transaction comes back.
        var (result, errors) = await rig.Service.RevertFinalFailureAsync(
            BackOn(rig.DeedB), "coordinator-1", Coordinator);

        Assert.Null(errors);
        Assert.Equal(2, result!.Count);
        Assert.All(result, f => Assert.Equal(PropertyFailureStatus.Resolved, f.Status));
        Assert.All(result, f => Assert.Equal(BackReason, f.ResolutionReason));
        Assert.All(result, f => Assert.Equal(Reason, f.FinalNote));

        var deeds = await rig.Bundle.CaseStudy.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == rig.DeedA || p.Id == rig.DeedB)
            .ToListAsync();
        Assert.All(deeds, d => Assert.Equal(FailureRecordRules.DeedStatusActive, d.DeedStatus));
        var survey = await rig.Bundle.CaseStudy.WorkflowTasks.AsNoTracking()
            .SingleAsync(t => t.Kind == WorkflowTaskKind.EngineeringSurvey);
        Assert.Equal(WorkflowTaskStatus.Open, survey.Status);
        Assert.Null(survey.ObstructionReason);

        Assert.Contains(
            rig.Notifications.Sent,
            n => n.Title == "رجوع المعاملة من التعذّر النهائي" && n.Body?.Contains(BackReason) == true);
        Assert.Contains("user-office", rig.Notifications.Recipients);
    }

    [Fact]
    public async Task The_case_study_task_returns_to_the_phase_it_left()
    {
        await using var rig = Arrange();
        var now = DateTime.UtcNow;
        // Deed A: escalated before the final failure (obstruction phase). Deed B: stopped by it directly.
        var escalated = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty, Po, now, phase: WorkflowTaskPhase.CaseStudy, propertyId: rig.DeedA);
        escalated.Block("تداخل حدود", now);
        var direct = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty, Po, now, phase: WorkflowTaskPhase.Distribution, propertyId: rig.DeedB);
        rig.Bundle.CaseStudy.WorkflowTasks.AddRange(escalated, direct);
        await rig.Bundle.CaseStudy.SaveChangesAsync();
        await rig.Service.RecordFinalFailureAsync(FinalOn(rig.DeedA));
        Assert.All(
            await rig.Bundle.CaseStudy.WorkflowTasks.AsNoTracking().ToListAsync(),
            t => Assert.Equal(WorkflowTaskStatus.Blocked, t.Status));

        var (_, errors) = await rig.Service.RevertFinalFailureAsync(BackOn(rig.DeedA), null, Coordinator);

        Assert.Null(errors);
        var tasks = await rig.Bundle.CaseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty)
            .ToListAsync();
        Assert.All(tasks, t => Assert.Equal(WorkflowTaskStatus.Open, t.Status));
        Assert.Equal(WorkflowTaskPhase.CaseStudy, tasks.Single(t => t.Id == escalated.Id).Phase);
        Assert.Equal(WorkflowTaskPhase.Distribution, tasks.Single(t => t.Id == direct.Id).Phase);
    }

    [Fact]
    public async Task Another_open_hold_keeps_the_case_study_task_stopped()
    {
        await using var rig = Arrange();
        var now = DateTime.UtcNow;
        var study = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty, Po, now, phase: WorkflowTaskPhase.CaseStudy, propertyId: rig.DeedA);
        study.Block(FailureRules.EvictionTitle, now);
        rig.Bundle.CaseStudy.WorkflowTasks.Add(study);
        await rig.Bundle.CaseStudy.SaveChangesAsync();
        rig.Bundle.Failures.PropertyFailures.Add(
            FailureRules.NewEvictionHold(Po, rig.DeedA, "1001", "النظام", now));
        await rig.Bundle.Failures.SaveChangesAsync();
        await rig.Service.RecordFinalFailureAsync(FinalOn(rig.DeedA));

        var (_, errors) = await rig.Service.RevertFinalFailureAsync(BackOn(rig.DeedA), null, Coordinator);

        Assert.Null(errors);
        var tasks = await rig.Bundle.CaseStudy.WorkflowTasks.AsNoTracking().ToListAsync();
        Assert.Equal(WorkflowTaskStatus.Blocked, tasks.Single(t => t.Id == study.Id).Status);
        Assert.Equal(
            WorkflowTaskStatus.Open,
            tasks.Single(t => t.Kind == WorkflowTaskKind.EngineeringSurvey).Status);
    }

    [Fact]
    public async Task Only_a_final_transaction_comes_back_and_only_once()
    {
        await using var rig = Arrange();

        var (_, notFinal) = await rig.Service.RevertFinalFailureAsync(BackOn(rig.DeedA), null, Coordinator);
        Assert.Equal(FailureRecordRules.NotFinalFailureAr, notFinal!["propertyId"]);

        await rig.Service.RecordFinalFailureAsync(FinalOn(rig.DeedA));
        var (first, _) = await rig.Service.RevertFinalFailureAsync(BackOn(rig.DeedA), null, Coordinator);
        var (second, again) = await rig.Service.RevertFinalFailureAsync(BackOn(rig.DeedA), null, Coordinator);

        Assert.NotNull(first);
        Assert.Null(second);
        Assert.True(again!.ContainsKey("propertyId"));
    }

    [Fact]
    public async Task Coming_back_needs_a_reason_and_the_coordination_sub_role()
    {
        await using var rig = Arrange();
        await rig.Service.RecordFinalFailureAsync(FinalOn(rig.DeedA));

        var (_, noReason) = await rig.Service.RevertFinalFailureAsync(BackOn(rig.DeedA, "  "), null, Coordinator);
        Assert.True(noReason!.ContainsKey("reason"));

        var (_, denied) = await rig.Service.RevertFinalFailureAsync(
            BackOn(rig.DeedA), null, new StaffActor(StaffRoleIds.SectionSupervisor, []));
        Assert.Equal(FailureRecordRules.RevertFinalFailureRoleDeniedAr, denied!["_"]);

        Assert.All(
            await rig.Bundle.Failures.PropertyFailures.AsNoTracking().ToListAsync(),
            f => Assert.Equal(PropertyFailureStatus.Approved, f.Status));
    }

    /// <summary>Omar 2026-11-12: coordination talks to Enfaz, so it alone takes the final failure back.</summary>
    [Theory]
    [InlineData("case-specialist", CaseSpecialistSubRoles.Coordination, true)]
    [InlineData("case-specialist", CaseSpecialistSubRoles.Study, false)]
    [InlineData("case-specialist", CaseSpecialistSubRoles.Review, false)]
    [InlineData("section-supervisor", null, false)]
    [InlineData("cdo", null, false)]
    [InlineData("general-manager", null, false)]
    [InlineData("field-inspector", CaseSpecialistSubRoles.Coordination, false)]
    public void Only_coordination_takes_the_final_failure_back(string role, string? subRole, bool allowed) =>
        Assert.Equal(
            allowed,
            PoRoleMatrixRules.CanRevertFinalFailure(new StaffActor(role, subRole is null ? [] : [subRole])));

    [Fact]
    public void Only_a_final_failure_can_be_taken_back()
    {
        var failure = PropertyFailure.Create(
            Guid.NewGuid(), Po, Guid.NewGuid(), "1001", "تداخل حدود", "boundary-overlap",
            PropertyFailureSeverity.Internal, "الأخصائي", "", "أسامة", DateTime.UtcNow);

        Assert.False(failure.TryRevertFinal(BackReason, DateTime.UtcNow));
        Assert.True(failure.TryFinalize(Reason, DateTime.UtcNow));
        // The ordinary «تم الحل» still refuses a final failure.
        Assert.False(failure.TryResolve("حُل", "تابع", DateTime.UtcNow));
        Assert.True(failure.TryRevertFinal($"  {BackReason} ", DateTime.UtcNow));
        Assert.Equal(PropertyFailureStatus.Resolved, failure.Status);
        Assert.Equal(BackReason, failure.ResolutionReason);
        Assert.False(failure.TryRevertFinal(BackReason, DateTime.UtcNow));
    }

    /// <summary>
    /// One transaction of two live deeds (and a removed third) on one work order; deed A carries
    /// an open survey task held by the engineering office «eo-1» (user «user-office»).
    /// </summary>
    private static Rig Arrange()
    {
        var bundle = TestBoundedContexts.Create($"final-failure-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;
        var order = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = Po,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(7)),
            CreatedAtUtc = now,
        };
        var transaction = Transaction.CreateDraft("TMP-26-00042", now);
        WorkOrderProperty Deed(string number, bool removed = false) => new()
        {
            Id = Guid.NewGuid(),
            WorkOrderId = order.Id,
            TransactionId = transaction.Id,
            IdentifierType = PropertyIdentifierType.Deed,
            DeedNumber = number,
            IsRemoved = removed,
        };
        var deedA = Deed("1001");
        var deedB = Deed("1002");
        db.WorkOrders.Add(order);
        db.Transactions.Add(transaction);
        db.WorkOrderProperties.AddRange(deedA, deedB, Deed("1003", removed: true));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey, Po, now, title: "رفع مساحي",
            propertyId: deedA.Id, assigneeId: "eo-1",
            assigneeRole: StaffRoleIds.EngineeringOffice, assigneeName: "مكتب"));

        var identity = TestInspectorFeeServiceFactory.ShareIdentity(db);
        identity.Users.Add(new ApplicationUser
        {
            Id = "user-office",
            UserName = "user-office",
            Email = "user-office@example.test",
            NormalizedEmail = "USER-OFFICE@EXAMPLE.TEST",
            DisplayName = "مكتب",
        });
        identity.UserProfiles.Add(new UserProfile
        {
            UserId = "user-office",
            DistributionAssigneeId = "eo-1",
            JobTitle = "party",
            RoleId = StaffRoleIds.EngineeringOffice,
            Status = UserStatus.Active,
            CreatedAtUtc = now,
        });
        identity.SaveChanges();
        db.SaveChanges();

        var notifications = new RecordingNotifications();
        var service = new FailureService(
            new FailureRepository(bundle.Failures),
            new CaseStudyLookup(db),
            new CaseStudyFailureCommands(
                db,
                new WorkflowTaskShellPatcher(
                    db,
                    new WorkflowTaskPatchNotifier(
                        new RecordingNotifications(),
                        TestNotificationRecipients.ForContexts(db, identity))),
                new PropertyTimelineService(db, new FailureLookup(bundle.Failures))),
            notifications,
            TestNotificationRecipients.ForContexts(db, identity),
            new UserLabelLookup(identity),
            new AuditLogWriter(),
            new RecordingAuditLogAppend());

        return new Rig(bundle, service, notifications, deedA.Id, deedB.Id);
    }

    private sealed class Rig(
        TestBoundedContexts.Bundle bundle,
        FailureService service,
        RecordingNotifications notifications,
        Guid deedA,
        Guid deedB) : IAsyncDisposable
    {
        public TestBoundedContexts.Bundle Bundle { get; } = bundle;
        public FailureService Service { get; } = service;
        public RecordingNotifications Notifications { get; } = notifications;
        public Guid DeedA { get; } = deedA;
        public Guid DeedB { get; } = deedB;

        public async ValueTask DisposeAsync()
        {
            await Bundle.CaseStudy.DisposeAsync();
            await Bundle.Failures.DisposeAsync();
            await Bundle.Ops.DisposeAsync();
        }
    }
}
