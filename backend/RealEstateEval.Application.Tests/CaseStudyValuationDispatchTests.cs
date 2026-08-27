using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

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
        Assert.Equal(PropertyId.ToString(), vr.PropertyId);
        Assert.Equal(ValuationRequestStatus.Progress, vr.Status);
        Assert.Equal("جدة", vr.Area);
        Assert.Equal("فيلا", vr.PropertyType);
        Assert.Equal("عبدالله الكثيري", vr.Appraiser);
        Assert.StartsWith("VR-", vr.DisplayId);

        var draft = await contexts.CaseStudy.PartyTaskSubmissions.SingleAsync();
        Assert.Equal(AppraisalTaskId, draft.WorkflowTaskId);
        Assert.Contains("\"reportNo\":\"TQ", draft.PayloadJson, StringComparison.Ordinal);

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
                Status = "submitted",
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

        var form = new CaseStudyFormDto
        {
            TaskId = ParentTaskId.ToString(),
            PropertyId = PropertyId.ToString(),
            PoNumber = "PO-900",
            Status = "submitted",
        };

        var (_, firstErrors) = await forms.SaveAsync(ParentTaskId, party: false, form);
        Assert.Null(firstErrors);

        form.Status = "draft";
        var (_, draftErrors) = await forms.SaveAsync(ParentTaskId, party: false, form);
        Assert.NotNull(draftErrors);

        form.Status = "submitted";
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
                Status = "submitted",
            });
        Assert.Null(errors);
        Assert.NotNull(dto);

        var task = await contexts.CaseStudy.WorkflowTasks.AsNoTracking()
            .SingleAsync(row => row.Id == ParentTaskId);
        Assert.Equal(WorkflowTaskStatus.Completed, task.Status);
        Assert.Equal(WorkflowTaskPhase.Done, task.Phase);
    }

    private static CaseStudyFormService CreateFormService(TestDatabases.ContextSet contexts)
    {
        var workflow = TestInspectorFeeServiceFactory.CreateWorkflow(contexts.CaseStudy);
        return new CaseStudyFormService(contexts.CaseStudy, workflow);
    }

    private static CaseStudyValuationDispatchService CreateDispatch(TestDatabases.ContextSet contexts)
    {
        var timeline = TestInspectorFeeServiceFactory.CreateTimeline(contexts.CaseStudy);
        var valuation = new ValuationRequestService(
            contexts.Valuation,
            new ValuationOutboxPublisher(
                contexts.Valuation,
                NullLogger<ValuationOutboxPublisher>.Instance),
            new CaseStudyPropertyPoNumberLookup(contexts.CaseStudy));
        return new CaseStudyValuationDispatchService(
            contexts.CaseStudy,
            valuation,
            timeline,
            NullLogger<CaseStudyValuationDispatchService>.Instance);
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
