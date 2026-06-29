using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class CaseStudyPartyFormLockTests
{
    private static readonly Guid PropertyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid ParentTaskId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly Guid AppraisalTaskId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static readonly Guid WorkOrderId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");

    [Fact]
    public async Task Parent_submission_locks_existing_party_forms()
    {
        await using var db = CreateDb();
        SeedWorkflow(db);
        db.CaseStudyForms.Add(new CaseStudyForm
        {
            Id = Guid.NewGuid(),
            TaskId = AppraisalTaskId,
            IsPartyForm = true,
            Status = "draft",
            AnswersJson = "{}",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var forms = CreateFormService(db);
        var (_, errors) = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new CaseStudyFormDto
            {
                TaskId = ParentTaskId.ToString(),
                PropertyId = PropertyId.ToString(),
                PoNumber = "PO-900",
                Status = "submitted",
            });

        Assert.Null(errors);
        var partyForm = await db.CaseStudyForms.SingleAsync(f => f.IsPartyForm);
        Assert.Equal("submitted", partyForm.Status);
    }

    [Fact]
    public async Task Party_save_rejected_when_parent_form_submitted()
    {
        await using var db = CreateDb();
        SeedWorkflow(db);
        db.CaseStudyForms.Add(new CaseStudyForm
        {
            Id = Guid.NewGuid(),
            TaskId = ParentTaskId,
            IsPartyForm = false,
            Status = "submitted",
            AnswersJson = "{}",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var forms = CreateFormService(db);
        var (result, errors) = await forms.SaveAsync(
            AppraisalTaskId,
            party: true,
            new CaseStudyFormDto
            {
                TaskId = AppraisalTaskId.ToString(),
                Status = "draft",
                Answers = new Dictionary<string, object?> { ["deed_2"] = "A" },
            });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("لا يمكن تعديل إجابات الأطراف", errors!["_"]);
    }

    [Fact]
    public async Task Party_save_rejected_when_party_form_locked()
    {
        await using var db = CreateDb();
        SeedWorkflow(db);
        db.CaseStudyForms.Add(new CaseStudyForm
        {
            Id = Guid.NewGuid(),
            TaskId = AppraisalTaskId,
            IsPartyForm = true,
            Status = "submitted",
            AnswersJson = "{}",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var forms = CreateFormService(db);
        var (result, errors) = await forms.SaveAsync(
            AppraisalTaskId,
            party: true,
            new CaseStudyFormDto
            {
                TaskId = AppraisalTaskId.ToString(),
                Status = "draft",
                Answers = new Dictionary<string, object?> { ["deed_2"] = "B" },
            });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("إغلاق نموذج الطرف", errors!["_"]);
    }

    private static CaseStudyFormService CreateFormService(ApplicationDbContext db)
    {
        var timeline = new PropertyTimelineService(db);
        var valuation = new ValuationRequestService(
            db,
            new OutboxIntegrationEventPublisher(db, NullLogger<OutboxIntegrationEventPublisher>.Instance));
        var dispatch = new CaseStudyValuationDispatchService(
            db,
            valuation,
            timeline,
            NullLogger<CaseStudyValuationDispatchService>.Instance);
        var fees = TestInspectorFeeServiceFactory.Create(db);
        var workflow = new WorkflowTaskService(db, fees, timeline);
        return new CaseStudyFormService(db, dispatch, workflow);
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"case-study-party-lock-{Guid.NewGuid():N}")
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
