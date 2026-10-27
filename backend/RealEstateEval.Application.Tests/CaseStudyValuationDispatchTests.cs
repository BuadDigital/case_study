using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Valuation.Infrastructure.Services;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;

namespace RealEstateEval.Application.Tests;

public class CaseStudyValuationDispatchTests
{
    private static readonly Guid PropertyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid ParentTaskId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly Guid AppraisalTaskId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static readonly Guid WorkOrderId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");

    [Fact]
    public async Task Appraisal_spawn_creates_valuation_request()
    {
        await using var contexts = TestDatabases.Create("case-study-valuation");
        SeedWorkflow(contexts.CaseStudy);

        var dispatch = CreateDispatch(contexts);
        await dispatch.TryCreateWhenAppraisalSpawnedAsync(ParentTaskId);

        var vr = await contexts.Valuation.ValuationRequests.SingleAsync();
        Assert.Equal(PropertyId, vr.PropertyId);
        Assert.Equal(ValuationRequestStatus.Progress, vr.Status);
        Assert.Equal("جدة", vr.Area);
        Assert.Equal("فيلا", vr.PropertyType);
        Assert.Equal("عبدالله الكثيري", vr.Appraiser);
        Assert.StartsWith("VR-", vr.DisplayId);

        // No report number is reserved at dispatch — it is fixed at approval.
        Assert.Equal(0, await contexts.CaseStudy.PartyTaskSubmissions.CountAsync());

        var outbox = await contexts.Messaging.OutboxMessages.SingleAsync();
        Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, outbox.EventType);
    }

    [Fact]
    public async Task Case_study_form_submission_does_not_create_valuation_request()
    {
        await using var contexts = TestDatabases.Create("case-study-valuation");
        SeedWorkflow(contexts.CaseStudy);

        var forms = CreateFormService(contexts);
        var (dto, errors) = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new()
            {
                TaskId = ParentTaskId.ToString(),
                PropertyId = PropertyId.ToString(),
                PoNumber = "PO-900",
                Status = "issued",
            });
        Assert.Null(errors);
        Assert.NotNull(dto);
        Assert.Equal(0, await contexts.Valuation.ValuationRequests.CountAsync());
    }

    [Fact]
    public async Task Submitted_form_is_locked_and_never_redispatches()
    {
        await using var contexts = TestDatabases.Create("case-study-valuation");
        SeedWorkflow(contexts.CaseStudy);

        var forms = CreateFormService(contexts);

        var form = new CaseStudyReportDto
        {
            TaskId = ParentTaskId.ToString(),
            PropertyId = PropertyId.ToString(),
            PoNumber = "PO-900",
            Status = "issued",
        };

        var (_, firstErrors) = await forms.SaveAsync(ParentTaskId, party: false, form);
        Assert.Null(firstErrors);

        form.Status = "draft";
        var (_, draftErrors) = await forms.SaveAsync(ParentTaskId, party: false, form);
        Assert.NotNull(draftErrors);

        form.Status = "issued";
        var (_, submitErrors) = await forms.SaveAsync(ParentTaskId, party: false, form);
        Assert.NotNull(submitErrors);

        Assert.Equal(0, await contexts.Valuation.ValuationRequests.CountAsync());
    }

    [Fact]
    public async Task Case_study_form_submission_completes_parent_workflow_task()
    {
        await using var contexts = TestDatabases.Create("case-study-valuation");
        SeedWorkflow(contexts.CaseStudy);

        var forms = CreateFormService(contexts);
        var (dto, errors) = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new()
            {
                TaskId = ParentTaskId.ToString(),
                PropertyId = PropertyId.ToString(),
                PoNumber = "PO-900",
                Status = "issued",
            });
        Assert.Null(errors);
        Assert.NotNull(dto);

        var task = await contexts.CaseStudy.WorkflowTasks.AsNoTracking()
            .SingleAsync(row => row.Id == ParentTaskId);
        Assert.Equal(WorkflowTaskStatus.Completed, task.Status);
        Assert.Equal(WorkflowTaskPhase.Done, task.Phase);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_transaction_merged_before_distribution_keeps_one_valuation_whatever_the_order(bool siblingFirst)
    {
        // Omar 2026-10-20: merging needs only the bourse stage, so the deeds may be distributed after it.
        await using var contexts = TestDatabases.Create("case-study-valuation-merged");
        SeedWorkflow(contexts.CaseStudy);
        var (siblingId, siblingParentId) = SeedSiblingInTransaction(contexts.CaseStudy);

        var dispatch = CreateDispatch(contexts);
        if (siblingFirst)
        {
            await dispatch.TryCreateWhenAppraisalSpawnedAsync(siblingParentId);
            await dispatch.TryCreateWhenAppraisalSpawnedAsync(ParentTaskId);
        }
        else
        {
            await dispatch.TryCreateWhenAppraisalSpawnedAsync(ParentTaskId);
            await dispatch.TryCreateWhenAppraisalSpawnedAsync(siblingParentId);
        }

        var rows = await contexts.Valuation.ValuationRequests.AsNoTracking().ToListAsync();
        var holderRequest = Assert.Single(rows, r => r.PropertyId == PropertyId);
        Assert.Equal(ValuationRequestStatus.Progress, holderRequest.Status);
        Assert.All(rows.Where(r => r.PropertyId == siblingId), r =>
        {
            Assert.Equal(ValuationRequestStatus.Merged, r.Status);
            Assert.Equal<Guid?>(holderRequest.Id, r.MergedIntoRequestId);
        });

        var service = CreateValuation(contexts);
        var openForSibling = await service.GetOpenByPropertyAsync(siblingId.ToString("D"));
        Assert.Equal<Guid?>(holderRequest.Id, openForSibling?.Id);
    }

    private static (Guid SiblingId, Guid SiblingParentId) SeedSiblingInTransaction(CaseStudyDbContext db)
    {
        var now = DateTime.UtcNow;
        var siblingId = Guid.NewGuid();
        var siblingParentId = Guid.NewGuid();
        var transaction = Transaction.CreateDraft("TMP-26-00900", now);
        transaction.StudyHolderPropertyId = PropertyId;
        transaction.LinkKind = TransactionLinkKinds.OneBuilding;
        db.Transactions.Add(transaction);
        var holder = db.WorkOrderProperties.Single(p => p.Id == PropertyId);
        holder.TransactionId = transaction.Id;
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = siblingId,
            WorkOrderId = WorkOrderId,
            TransactionId = transaction.Id,
            City = "جدة",
            PropertyType = "فيلا",
            DeedNumber = "1234567891",
        });
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-900",
                now,
                title: "دراسة حالة",
                phase: WorkflowTaskPhase.CaseStudy,
                id: siblingParentId,
                propertyId: siblingId),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal,
                "PO-900",
                now,
                title: "تقييم عقاري",
                phase: WorkflowTaskPhase.Done,
                assigneeName: "عبدالله الكثيري",
                propertyId: siblingId,
                parentTaskId: siblingParentId));
        db.SaveChanges();
        return (siblingId, siblingParentId);
    }

    private static ValuationRequestService CreateValuation(TestDatabases.ContextSet contexts) =>
        new(
            contexts.Valuation,
            new ValuationOutboxPublisher(
                contexts.Valuation,
                NullLogger<ValuationOutboxPublisher>.Instance),
            new CaseStudyPropertyPoNumberLookup(contexts.CaseStudy));

    private static CaseStudyReportService CreateFormService(TestDatabases.ContextSet contexts)
    {
        var workflow = TestInspectorFeeServiceFactory.CreateWorkflow(contexts.CaseStudy);
        return new CaseStudyReportService(new CaseStudyReportRepository(contexts.CaseStudy), workflow);
    }

    private static CaseStudyValuationDispatchService CreateDispatch(TestDatabases.ContextSet contexts)
    {
        var timeline = TestInspectorFeeServiceFactory.CreateTimeline(contexts.CaseStudy);
        return new CaseStudyValuationDispatchService(
            new CaseStudyValuationDispatchRepository(contexts.CaseStudy),
            CreateValuation(contexts),
            timeline,
            NullLogger<CaseStudyValuationDispatchService>.Instance,
            folding: new ValuationRequestFoldingService(contexts.Valuation));
    }

    private static void SeedWorkflow(CaseStudyDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkOrders.Add(new WorkOrder
        {
            Id = WorkOrderId,
            PoNumber = "PO-900",
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
        });
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-900",
                now,
                title: "دراسة حالة",
                phase: WorkflowTaskPhase.CaseStudy,
                id: ParentTaskId,
                propertyId: PropertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal,
                "PO-900",
                now,
                title: "تقييم عقاري",
                phase: WorkflowTaskPhase.Done,
                assigneeName: "عبدالله الكثيري",
                id: AppraisalTaskId,
                propertyId: PropertyId,
                parentTaskId: ParentTaskId));
        db.SaveChanges();
    }
}
