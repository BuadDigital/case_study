using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The appraiser hands a transaction on without reassigning it himself (Omar 2026-11-18): a request to
/// whoever handed it to him (alone for five working minutes, then the team), or a transfer to a colleague
/// who accepts. Plus the working-minute calendar the head start counts in.
/// </summary>
public class AppraiserHandoverServiceTests
{
    private static readonly Guid Parent = Guid.Parse("c0000000-0000-0000-0000-00000000000c");
    private static readonly Guid Appraisal = Guid.Parse("c1000000-0000-0000-0000-00000000000c");
    private static readonly Guid Property = Guid.Parse("c3000000-0000-0000-0000-00000000000c");

    // Sunday 2026-11-15 10:00 Riyadh.
    private static readonly DateTimeOffset SundayTen = new(2026, 11, 15, 7, 0, 0, TimeSpan.Zero);

    private static readonly PartySubmissionActor Appraiser = new()
    {
        UserId = "u-app", DisplayName = "سعد", PrototypeRole = "real-estate-appraiser",
        DistributionAssigneeId = "val-saad",
    };

    private static readonly PartySubmissionActor Colleague = new()
    {
        UserId = "u-col", DisplayName = "صالح", PrototypeRole = "real-estate-appraiser",
        DistributionAssigneeId = "val-saleh",
    };

    private static readonly PartySubmissionActor StudySpecialist = new()
    {
        UserId = "u-study", DisplayName = "دارس", PrototypeRole = "case-specialist",
        SubRoles = [CaseSpecialistSubRoles.Study],
    };

    private static readonly PartySubmissionActor OtherStudy = new()
    {
        UserId = "u-study-2", DisplayName = "دارس آخر", PrototypeRole = "case-specialist",
        SubRoles = [CaseSpecialistSubRoles.Study],
    };

    // ---- the calendar ----

    [Theory]
    [InlineData("2026-11-15T10:00", 5, "2026-11-15T10:05")] // Sunday morning
    [InlineData("2026-11-15T07:00", 5, "2026-11-15T08:05")] // before work starts
    [InlineData("2026-11-19T16:58", 5, "2026-11-22T08:03")] // Thursday evening → Sunday
    [InlineData("2026-11-20T11:00", 5, "2026-11-22T08:05")] // Friday
    [InlineData("2026-11-15T20:00", 0, "2026-11-16T08:00")] // night, zero minutes → next start
    public void Working_minutes_count_only_sunday_to_thursday_eight_to_five(string fromRiyadh, int minutes, string expectedRiyadh)
    {
        var from = RiyadhClock.ToUtc(DateTime.Parse(fromRiyadh));
        var expected = RiyadhClock.ToUtc(DateTime.Parse(expectedRiyadh));

        Assert.Equal(expected, WorkCalendar.AddWorkingMinutes(from, minutes));
    }

    // ---- reassignment request ----

    [Fact]
    public async Task The_request_goes_to_the_study_specialist_alone_then_to_the_team()
    {
        await using var rig = Arrange();
        var (request, errors) = await rig.Service.RequestReassignmentAsync(
            new RequestAppraiserReassignmentRequest { AppraisalTaskId = Appraisal, Reason = "سأغيب غدًا" }, Appraiser);

        Assert.Null(errors);
        Assert.Equal(CaseSpecialistSubRoles.Study, request!.HandlerSubRole);
        Assert.False(request.Escalated);
        // Before the head start only the specialist who issued the study takes it.
        var (_, early) = await rig.Service.TakeAsync(Guid.Parse(request.Id), OtherStudy);
        Assert.Equal(AppraiserHandoverService.NotHandlerAr, early!["_"]);

        rig.Clock.Advance(TimeSpan.FromMinutes(6));
        await rig.Service.SweepAsync();

        var (taken, takeErrors) = await rig.Service.TakeAsync(Guid.Parse(request.Id), OtherStudy);
        Assert.Null(takeErrors);
        Assert.Equal(AppraiserHandoverStatuses.Taken, taken!.Status);
        Assert.Equal("دارس آخر", taken.TakenByName);
        // The first to take it handles it.
        var (_, second) = await rig.Service.TakeAsync(Guid.Parse(request.Id), StudySpecialist);
        Assert.Contains("دارس آخر", second!["_"]);
    }

    [Fact]
    public async Task Completing_the_request_moves_the_appraiser_with_the_work_kept()
    {
        await using var rig = Arrange();
        var (request, _) = await rig.Service.RequestReassignmentAsync(
            new RequestAppraiserReassignmentRequest { AppraisalTaskId = Appraisal, Reason = "سأغيب غدًا" }, Appraiser);

        var (done, errors) = await rig.Service.CompleteReassignmentAsync(
            Guid.Parse(request!.Id),
            new CompleteAppraiserReassignmentRequest { NewAssigneeId = "val-saleh", NewAssigneeName = "صالح" },
            StudySpecialist);

        Assert.Null(errors);
        Assert.Equal(AppraiserHandoverStatuses.Done, done!.Status);
        var task = await rig.Contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == Appraisal);
        Assert.Equal("val-saleh", task.AssigneeId);
    }

    [Fact]
    public async Task Only_the_assigned_appraiser_asks_and_only_once()
    {
        await using var rig = Arrange();
        var (_, notHis) = await rig.Service.RequestReassignmentAsync(
            new RequestAppraiserReassignmentRequest { AppraisalTaskId = Appraisal, Reason = "x" }, Colleague);
        Assert.Equal(AppraiserHandoverService.NotAssignedAr, notHis!["_"]);

        await rig.Service.RequestReassignmentAsync(
            new RequestAppraiserReassignmentRequest { AppraisalTaskId = Appraisal, Reason = "سأغيب" }, Appraiser);
        var (_, twice) = await rig.Service.RequestReassignmentAsync(
            new RequestAppraiserReassignmentRequest { AppraisalTaskId = Appraisal, Reason = "سأغيب" }, Appraiser);
        Assert.Equal(AppraiserHandoverService.AlreadyOpenAr, twice!["_"]);
    }

    // ---- peer transfer ----

    [Fact]
    public async Task A_peer_transfer_moves_when_the_colleague_accepts()
    {
        await using var rig = Arrange();
        var (offer, errors) = await rig.Service.RequestPeerTransferAsync(
            new RequestPeerTransferRequest
            {
                AppraisalTaskId = Appraisal,
                Direction = AppraiserHandoverDirections.Offer,
                PeerAssigneeId = "val-saleh",
                PeerName = "صالح",
            },
            Appraiser);
        Assert.Null(errors);
        Assert.Equal("val-saad",
            (await rig.Contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == Appraisal)).AssigneeId);

        // Only the colleague accepts.
        var (_, notHim) = await rig.Service.AcceptPeerAsync(Guid.Parse(offer!.Id), Appraiser);
        Assert.Equal(AppraiserHandoverService.NotPeerAr, notHim!["_"]);

        var (accepted, acceptErrors) = await rig.Service.AcceptPeerAsync(Guid.Parse(offer.Id), Colleague);
        Assert.Null(acceptErrors);
        Assert.Equal(AppraiserHandoverStatuses.Done, accepted!.Status);
        Assert.Equal("val-saleh",
            (await rig.Contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == Appraisal)).AssigneeId);
    }

    [Fact]
    public async Task The_appraiser_cancels_his_request_and_a_declined_transfer_moves_nothing()
    {
        await using var rig = Arrange();
        var (request, _) = await rig.Service.RequestReassignmentAsync(
            new RequestAppraiserReassignmentRequest { AppraisalTaskId = Appraisal, Reason = "سأغيب" }, Appraiser);
        var (cancelled, _) = await rig.Service.CancelAsync(Guid.Parse(request!.Id), new CloseAppraiserHandoverRequest(), Appraiser);
        Assert.Equal(AppraiserHandoverStatuses.Cancelled, cancelled!.Status);

        var (offer, _) = await rig.Service.RequestPeerTransferAsync(
            new RequestPeerTransferRequest
            {
                AppraisalTaskId = Appraisal, Direction = AppraiserHandoverDirections.Offer, PeerAssigneeId = "val-saleh",
            },
            Appraiser);
        var (declined, _) = await rig.Service.DeclinePeerAsync(Guid.Parse(offer!.Id), new CloseAppraiserHandoverRequest(), Colleague);
        Assert.Equal(AppraiserHandoverStatuses.Declined, declined!.Status);
        Assert.Equal("val-saad",
            (await rig.Contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == Appraisal)).AssigneeId);
    }

    // ---- arrangement ----

    private static Rig Arrange()
    {
        var contexts = TestDatabases.Create("appraiser-handover");
        var db = contexts.CaseStudy;
        var now = SundayTen.UtcDateTime;
        var transaction = new Transaction
        {
            Id = Guid.NewGuid(),
            HandedToReviewAtUtc = now,
            HandedToReviewByUserId = "u-study",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        db.Transactions.Add(transaction);
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = Property,
            WorkOrderId = Guid.NewGuid(),
            TransactionId = transaction.Id,
        });
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, "PO-HO", now, title: "دراسة",
                phase: WorkflowTaskPhase.CaseStudy, id: Parent, propertyId: Property),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal, "PO-HO", now, title: "تقييم",
                phase: WorkflowTaskPhase.Done, assigneeRole: "real-estate-appraiser",
                id: Appraisal, propertyId: Property, parentTaskId: Parent, assigneeId: "val-saad"));
        db.SaveChanges();

        var clock = new ManualClock(SundayTen);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        var service = new AppraiserHandoverService(
            new AppraiserHandoverRepository(db),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            notifications,
            recipients,
            clock);
        return new Rig(contexts, service, clock);
    }

    private sealed class ManualClock(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan by) => _now += by;
    }

    private sealed class Rig(TestDatabases.ContextSet contexts, AppraiserHandoverService service, ManualClock clock)
        : IAsyncDisposable
    {
        public TestDatabases.ContextSet Contexts { get; } = contexts;
        public AppraiserHandoverService Service { get; } = service;
        public ManualClock Clock { get; } = clock;
        public ValueTask DisposeAsync() => Contexts.DisposeAsync();
    }
}
