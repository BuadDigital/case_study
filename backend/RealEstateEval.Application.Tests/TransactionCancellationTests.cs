using System.Reflection;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// «إلغاء المعاملة» (decided with Omar 2026-10-29): the specialist requests, the supervisor approves,
/// rejects or reactivates; whole transactions across work orders; finished work stays; keys keep their link.
/// </summary>
public class TransactionCancellationTests
{
    private static readonly TransactionCancellationActor Specialist = new("u-spec", "أسامة", "case-specialist");
    private static readonly TransactionCancellationActor Supervisor = new("u-sup", "سليمان", "section-supervisor");
    private static readonly TransactionCancellationActor Appraiser = new("u-app", "عبدالله", "real-estate-appraiser");

    private static RequestTransactionCancellationRequest Ask(Guid? propertyId = null, string? po = null) => new()
    {
        PropertyId = propertyId,
        PoNumber = po,
        ReasonCode = TransactionCancellationReasons.Duplicate,
        Note = "أُدخلت مرتين",
    };

    [Fact]
    public async Task Specialist_request_waits_then_the_supervisor_cancels_every_deed_of_the_transaction()
    {
        await using var rig = await Rig.CreateAsync();

        var (pending, requestError) = await rig.Service.RequestAsync(Ask(rig.DeedA), Specialist);
        Assert.Null(requestError);
        Assert.Equal(TransactionCancellationStatuses.Pending, pending!.Status);
        Assert.Equal(2, pending.Deeds.Count);
        Assert.Null((await rig.Deed(rig.DeedA)).CancelledAtUtc);
        Assert.Contains("u-supervisor", rig.Notifications.Recipients);

        var (approved, approveError) = await rig.Service.ApproveAsync(
            pending.Id, new DecideTransactionCancellationRequest(), Supervisor);
        Assert.Null(approveError);
        Assert.Equal(TransactionCancellationStatuses.Approved, approved!.Status);

        var deedA = await rig.Deed(rig.DeedA);
        var deedB = await rig.Deed(rig.DeedB);
        Assert.True(deedA.IsCancelled);
        Assert.True(deedB.IsCancelled);
        Assert.Equal(WorkOrderProperty.CancelledDeedStatusAr, deedA.DeedStatus);
        Assert.Equal("فعال", deedA.PreCancelDeedStatus);
        Assert.False((await rig.Deed(rig.DeedOther)).IsCancelled);

        var tasks = await rig.Db.WorkflowTasks.AsNoTracking().ToListAsync();
        var inspection = tasks.Single(t => t.Kind == WorkflowTaskKind.FieldInspection);
        Assert.Equal(WorkflowTaskStatus.Completed, inspection.Status);
        Assert.All(
            tasks.Where(t => t.PropertyId == rig.DeedA || t.PropertyId == rig.DeedB).Where(t => t.Kind != WorkflowTaskKind.FieldInspection),
            t => Assert.Equal(WorkflowTaskStatus.Cancelled, t.Status));
        Assert.Equal(WorkflowTaskStatus.Open, tasks.Single(t => t.PropertyId == rig.DeedOther).Status);

        Assert.Equal(new[] { rig.DeedA, rig.DeedB }.Order(), rig.Fees.LedgerProperties.Order());
        Assert.Equal(2, rig.SideEffects.FailuresClosed.Count);
        Assert.Contains(rig.SideEffects.KeyCalls, c => c.Cancelled && c.Ids.Count == 2);
        Assert.Contains("u-inspector", rig.Notifications.Recipients);
        Assert.Contains("u-spec", rig.Notifications.Recipients);
        Assert.Contains(
            await rig.Db.PropertyTimelineEntries.AsNoTracking().Where(e => e.PropertyId == rig.DeedB).ToListAsync(),
            e => e.Title == "إلغاء المعاملة");
    }

    [Fact]
    public async Task Supervisor_request_is_approved_at_once_and_reactivation_puts_everything_back()
    {
        await using var rig = await Rig.CreateAsync();

        var (approved, error) = await rig.Service.RequestAsync(Ask(rig.DeedB), Supervisor);
        Assert.Null(error);
        Assert.Equal(TransactionCancellationStatuses.Approved, approved!.Status);
        Assert.True((await rig.Deed(rig.DeedA)).IsCancelled);

        var (_, noReason) = await rig.Service.ReactivateAsync(
            approved.Id, new ReactivateTransactionCancellationRequest(), Supervisor);
        Assert.Equal(TransactionCancellationRules.ReactivationNoteRequiredAr, noReason);

        var (reactivated, reactivateError) = await rig.Service.ReactivateAsync(
            approved.Id, new ReactivateTransactionCancellationRequest { Note = "أُلغيت بالخطأ" }, Supervisor);
        Assert.Null(reactivateError);
        Assert.Equal(TransactionCancellationStatuses.Reactivated, reactivated!.Status);

        var deedA = await rig.Deed(rig.DeedA);
        Assert.False(deedA.IsCancelled);
        Assert.Equal("فعال", deedA.DeedStatus);
        var tasks = await rig.Db.WorkflowTasks.AsNoTracking().Where(t => t.PropertyId == rig.DeedA).ToListAsync();
        Assert.Equal(WorkflowTaskStatus.Open, tasks.Single(t => t.Kind == WorkflowTaskKind.CaseStudyProperty).Status);
        Assert.Equal(WorkflowTaskStatus.Blocked, tasks.Single(t => t.Kind == WorkflowTaskKind.PropertyAppraisal).Status);
        Assert.All(tasks, t => Assert.Null(t.PreCancelStatus));
        Assert.Contains(rig.SideEffects.KeyCalls, c => !c.Cancelled);
    }

    [Fact]
    public async Task Refusals_follow_the_roles_and_the_deed_state()
    {
        await using var rig = await Rig.CreateAsync();

        var (_, roleError) = await rig.Service.RequestAsync(Ask(rig.DeedA), Appraiser);
        Assert.Equal(TransactionCancellationRules.ForbiddenRequestAr, roleError);

        var (_, reasonError) = await rig.Service.RequestAsync(
            new RequestTransactionCancellationRequest { PropertyId = rig.DeedA, ReasonCode = "x", Note = "n" },
            Specialist);
        Assert.Equal(TransactionCancellationRules.ReasonRequiredAr, reasonError);

        var (pending, _) = await rig.Service.RequestAsync(Ask(rig.DeedA), Specialist);
        var (_, decideError) = await rig.Service.ApproveAsync(pending!.Id, new DecideTransactionCancellationRequest(), Specialist);
        Assert.Equal(TransactionCancellationRules.ForbiddenDecideAr, decideError);

        var (_, twiceError) = await rig.Service.RequestAsync(Ask(rig.DeedB), Specialist);
        Assert.Equal(TransactionCancellationRules.DeedPendingAr, twiceError);

        var (rejected, rejectError) = await rig.Service.RejectAsync(
            pending.Id, new DecideTransactionCancellationRequest { Note = "ليست مكررة" }, Supervisor);
        Assert.Null(rejectError);
        Assert.Equal(TransactionCancellationStatuses.Rejected, rejected!.Status);
        Assert.False((await rig.Deed(rig.DeedA)).IsCancelled);

        // A deed on Enfaz keeps its whole transaction live.
        var deedB = await rig.Db.WorkOrderProperties.SingleAsync(p => p.Id == rig.DeedB);
        deedB.EnfazHandoverAtUtc = DateTime.UtcNow;
        await rig.Db.SaveChangesAsync();
        var (_, handedOver) = await rig.Service.RequestAsync(Ask(rig.DeedA), Specialist);
        Assert.Equal(TransactionCancellationRules.DeedHandedOverAr, handedOver);

        // From the work order, the blocked transaction is left out and the other one goes.
        var (preview, _) = await rig.Service.PreviewAsync(null, "PO-1");
        Assert.Equal([rig.DeedOther], preview!.Deeds.Select(d => d.PropertyId).ToList());
        Assert.Equal(2, preview.Excluded.Count);
    }

    [Fact]
    public void Cancelled_tasks_keep_their_state_against_patches_and_restore_their_status()
    {
        var now = DateTime.UtcNow;
        var task = WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-1", now, status: WorkflowTaskStatus.Blocked);
        Assert.True(task.CancelForTransaction(now));
        Assert.False(task.CancelForTransaction(now));

        task.ApplyShellPatch(WorkflowTaskPhase.Done, WorkflowTaskStatus.Completed, null, null, null, null, false, null, false, null, false, null, false, null, now);
        Assert.Equal(WorkflowTaskStatus.Cancelled, task.Status);

        Assert.True(task.RestoreAfterTransactionCancel(now));
        Assert.Equal(WorkflowTaskStatus.Blocked, task.Status);

        var done = WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-1", now, status: WorkflowTaskStatus.Completed);
        Assert.False(done.CancelForTransaction(now));
        Assert.Equal(WorkflowTaskStatus.Completed, done.Status);
    }

    [Fact]
    public void A_work_order_whose_live_deeds_are_all_cancelled_reads_cancelled()
    {
        Assert.Equal(WorkOrderListStatus.Cancelled, WorkOrderListStatus.ResolveStudy(null, 2, 2, 2, 2, cancelledCount: 2));
        Assert.Equal(WorkOrderListStatus.UnderStudy, WorkOrderListStatus.ResolveStudy(null, 2, 2, 1, 1, cancelledCount: 1));
        Assert.Equal(WorkOrderListStatus.Stopped, WorkOrderListStatus.ResolveStudy("stopped", 1, 1, 1, 1, cancelledCount: 1));

        var deed = new WorkOrderProperty { Id = Guid.NewGuid(), DeedStatus = "فعال" };
        deed.MarkCancelled(Guid.NewGuid(), DateTime.UtcNow);
        var finished = WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-1", DateTime.UtcNow, status: WorkflowTaskStatus.Completed);
        Assert.True(PropertyDeliveryRules.IsClosed(deed, [finished]));
    }

    [Fact]
    public void An_envelope_whose_untried_key_belongs_to_a_cancelled_property_is_ready_for_court_return()
    {
        var envelope = new KeyEnvelope { Status = KeyEnvelopeStatuses.Reviewer };
        var assignment = new KeyEnvelopeAssignment { Status = KeyAssignmentStatuses.Pending, KeyLocation = KeyLocations.InEnvelope };
        envelope.Assignments.Add(assignment);
        Assert.False(KeyEnvelopeLifecycleRules.ReadyForCourtReturn(envelope));

        assignment.PropertyCancelledAtUtc = DateTime.UtcNow;
        Assert.True(KeyEnvelopeLifecycleRules.ReadyForCourtReturn(envelope));

        assignment.KeyLocation = KeyLocations.WithUser;
        Assert.False(KeyEnvelopeLifecycleRules.ReadyForCourtReturn(envelope));
    }

    private sealed class Rig : IAsyncDisposable
    {
        private readonly TestDatabases.ContextSet _contexts;

        private Rig(TestDatabases.ContextSet contexts) => _contexts = contexts;

        public CaseStudyDbContext Db => _contexts.CaseStudy;
        public TransactionCancellationService Service { get; private set; } = null!;
        public RecordingNotifications Notifications { get; } = new();
        public RecordingFees Fees { get; private set; } = null!;
        public RecordingSideEffects SideEffects { get; } = new();
        public Guid DeedA { get; private set; }
        public Guid DeedB { get; private set; }
        public Guid DeedOther { get; private set; }

        public Task<WorkOrderProperty> Deed(Guid id) =>
            Db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == id);

        /// <summary>
        /// One linked transaction (deed A on PO-1, deed B on PO-2) and an ordinary one (PO-1). Deed A has
        /// an open parent, a finished inspection and a blocked appraisal; B and the other deed an open parent.
        /// </summary>
        public static async Task<Rig> CreateAsync()
        {
            var rig = new Rig(TestDatabases.Create("transaction-cancellation"));
            var db = rig.Db;
            var now = DateTime.UtcNow;
            var linked = Transaction.CreateDraft("TMP-26-00001", now);
            var single = Transaction.CreateDraft("TMP-26-00002", now);
            var po1 = Order("PO-1", now);
            var po2 = Order("PO-2", now);
            var a = Deed(po1, linked, "4213", now);
            var b = Deed(po2, linked, "4214", now);
            var other = Deed(po1, single, "4215", now);
            db.Transactions.AddRange(linked, single);
            db.WorkOrders.AddRange(po1, po2);

            var parentA = WorkflowTask.Create(WorkflowTaskKind.CaseStudyProperty, "PO-1", now, phase: WorkflowTaskPhase.CaseStudy, propertyId: a.Id, assigneeId: "u-spec");
            db.WorkflowTasks.AddRange(
                parentA,
                WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-1", now, phase: WorkflowTaskPhase.Done, status: WorkflowTaskStatus.Completed, propertyId: a.Id, parentTaskId: parentA.Id, assigneeId: "u-inspector"),
                WorkflowTask.Create(WorkflowTaskKind.PropertyAppraisal, "PO-1", now, phase: WorkflowTaskPhase.Done, status: WorkflowTaskStatus.Blocked, propertyId: a.Id, parentTaskId: parentA.Id),
                WorkflowTask.Create(WorkflowTaskKind.CaseStudyProperty, "PO-2", now, propertyId: b.Id),
                WorkflowTask.Create(WorkflowTaskKind.CaseStudyProperty, "PO-1", now, propertyId: other.Id));
            await db.SaveChangesAsync();

            rig.DeedA = a.Id;
            rig.DeedB = b.Id;
            rig.DeedOther = other.Id;
            rig.Fees = RecordingFees.Create();
            rig.Service = new TransactionCancellationService(
                new TransactionCancellationRepository(db),
                rig.Fees.AsService,
                rig.SideEffects,
                new PropertyTimelineService(db, new FailureLookup(rig._contexts.Failures)),
                rig.Notifications,
                new StubRecipients(a.Id),
                new AuditLogWriter(),
                new RecordingAuditLogAppend());
            return rig;
        }

        private static WorkOrder Order(string po, DateTime now) => new()
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now).AddDays(5),
            CreatedAtUtc = now,
        };

        private static WorkOrderProperty Deed(WorkOrder order, Transaction transaction, string number, DateTime now)
        {
            var deed = new WorkOrderProperty
            {
                Id = Guid.NewGuid(),
                WorkOrderId = order.Id,
                TransactionId = transaction.Id,
                Transaction = transaction,
                DeedNumber = number,
                DeedStatus = "فعال",
                BourseDataCompleted = true,
                City = "جدة",
                District = "الروضة",
                UpdatedAtUtc = now,
            };
            order.Properties.Add(deed);
            return deed;
        }

        public ValueTask DisposeAsync() => _contexts.DisposeAsync();
    }

    /// <summary>The supervisors, and the inspector + specialist on deed A while their tasks are live.</summary>
    private sealed class StubRecipients(Guid deedA) : INotificationRecipientResolver
    {
        public Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPropertyAsync(
            Guid propertyId, IReadOnlyCollection<WorkflowTaskKind> taskKinds, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<string>>(propertyId == deedA ? ["u-inspector", "u-spec"] : []);

        public Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPoAsync(
            string poNumber, IReadOnlyCollection<WorkflowTaskKind> taskKinds, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<string>>([]);

        public Task<string?> ResolveUserIdForDistributionAssigneeAsync(
            string distributionAssigneeId, CancellationToken cancellationToken = default) =>
            Task.FromResult<string?>(null);

        public Task<string?> ResolveUserIdForEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult<string?>(null);

        public Task<IReadOnlyDictionary<string, string>> ResolveUserIdsForDistributionAssigneesAsync(
            IReadOnlyCollection<string> distributionAssigneeIds, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>());

        public Task<IReadOnlyList<string>> ResolveUserIdsWithPrototypeRoleAsync(
            string prototypeRole, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<string>>(prototypeRole == "section-supervisor" ? ["u-supervisor"] : []);
    }

    private sealed class RecordingSideEffects : ITransactionCancellationSideEffects
    {
        public List<Guid> FailuresClosed { get; } = [];
        public List<(IReadOnlyList<Guid> Ids, bool Cancelled)> KeyCalls { get; } = [];

        public Task CloseOpenFailuresAsync(string poNumber, Guid propertyId, string actorName, CancellationToken cancellationToken = default)
        {
            FailuresClosed.Add(propertyId);
            return Task.CompletedTask;
        }

        public Task SetKeysPropertyCancelledAsync(IReadOnlyList<Guid> propertyIds, bool cancelled, string actorName, CancellationToken cancellationToken = default)
        {
            KeyCalls.Add((propertyIds, cancelled));
            return Task.CompletedTask;
        }
    }

    /// <summary>Records EnsureLedgersForPropertyAsync; every other fee member answers a completed default.</summary>
    public class RecordingFees : DispatchProxy
    {
        public List<Guid> LedgerProperties { get; } = [];
        public IInspectorFeeService AsService { get; private set; } = null!;

        public static RecordingFees Create()
        {
            var proxy = DispatchProxy.Create<IInspectorFeeService, RecordingFees>();
            var recorder = (RecordingFees)(object)proxy;
            recorder.AsService = proxy;
            return recorder;
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod!.Name == nameof(IInspectorFeeService.EnsureLedgersForPropertyAsync))
                LedgerProperties.Add((Guid)args![0]!);
            var returns = targetMethod.ReturnType;
            if (returns == typeof(Task)) return Task.CompletedTask;
            return returns.IsValueType ? Activator.CreateInstance(returns) : null;
        }
    }
}
