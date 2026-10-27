using Microsoft.EntityFrameworkCore;
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

namespace RealEstateEval.Application.Tests;

/// <summary>
/// «التعذر النهائي عن المعاملة»: the supervisor's final failure lands on every live deed of the
/// transaction — the escalated failure is finalized, a deed without one gets one filed — the deeds
/// stop, and the parties hear about it only when the supervisor asks.
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

    [Theory]
    [InlineData("section-supervisor", true)]
    [InlineData("cdo", true)]
    [InlineData("case-specialist", false)]
    [InlineData("general-manager", false)]
    [InlineData(null, false)]
    public void Only_the_supervisor_records_the_final_failure(string? role, bool allowed) =>
        Assert.Equal(allowed, FailureRecordRules.CanRecordFinalFailure(role));

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
