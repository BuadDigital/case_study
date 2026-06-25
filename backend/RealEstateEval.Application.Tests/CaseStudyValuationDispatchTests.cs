using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
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
    public async Task Case_study_form_submission_creates_valuation_request()
    {
        await using var db = CreateDb();
        SeedWorkflow(db);

        var fees = new InspectorFeeService(db);
        var timeline = new PropertyTimelineService(db);
        var valuation = new ValuationRequestService(
            db,
            new OutboxIntegrationEventPublisher(db, NullLogger<OutboxIntegrationEventPublisher>.Instance));
        var dispatch = new CaseStudyValuationDispatchService(
            db,
            valuation,
            timeline,
            NullLogger<CaseStudyValuationDispatchService>.Instance);
        var forms = new CaseStudyFormService(db, dispatch);

        await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new()
            {
                TaskId = ParentTaskId.ToString(),
                PropertyId = PropertyId.ToString(),
                PoNumber = "PO-900",
                Status = "submitted",
            });

        var vr = await db.ValuationRequests.SingleAsync();
        Assert.Equal(PropertyId.ToString(), vr.PropertyId);
        Assert.Equal("progress", vr.Status);
        Assert.Equal("جدة", vr.Area);
        Assert.Equal("فيلا", vr.PropertyType);
        Assert.Equal("عبدالله الكثيري", vr.Appraiser);
        Assert.StartsWith("VR-", vr.DisplayId);

        var outbox = await db.OutboxMessages.SingleAsync();
        Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, outbox.EventType);
    }

    [Fact]
    public async Task Second_submission_is_idempotent()
    {
        await using var db = CreateDb();
        SeedWorkflow(db);

        var fees = new InspectorFeeService(db);
        var timeline = new PropertyTimelineService(db);
        var valuation = new ValuationRequestService(
            db,
            new OutboxIntegrationEventPublisher(db, NullLogger<OutboxIntegrationEventPublisher>.Instance));
        var dispatch = new CaseStudyValuationDispatchService(
            db,
            valuation,
            timeline,
            NullLogger<CaseStudyValuationDispatchService>.Instance);
        var forms = new CaseStudyFormService(db, dispatch);

        var form = new CaseStudyFormDto
        {
            TaskId = ParentTaskId.ToString(),
            PropertyId = PropertyId.ToString(),
            PoNumber = "PO-900",
            Status = "submitted",
        };

        await forms.SaveAsync(ParentTaskId, party: false, form);
        form.Status = "draft";
        await forms.SaveAsync(ParentTaskId, party: false, form);
        form.Status = "submitted";
        await forms.SaveAsync(ParentTaskId, party: false, form);

        Assert.Equal(1, await db.ValuationRequests.CountAsync());
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"case-study-valuation-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static void SeedWorkflow(ApplicationDbContext db)
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
            new WorkflowTask
            {
                Id = ParentTaskId,
                Kind = "case-study-property",
                PoNumber = "PO-900",
                PropertyId = PropertyId,
                PropertyOrdinal = 1,
                Title = "دراسة حالة",
                Phase = "case-study",
                Status = WorkflowTaskStatus.Open,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            },
            new WorkflowTask
            {
                Id = AppraisalTaskId,
                Kind = "property-appraisal",
                PoNumber = "PO-900",
                PropertyId = PropertyId,
                PropertyOrdinal = 1,
                ParentTaskId = ParentTaskId,
                Title = "تقييم عقاري",
                Phase = "done",
                AssigneeName = "عبدالله الكثيري",
                Status = WorkflowTaskStatus.Open,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        db.SaveChanges();
    }
}
