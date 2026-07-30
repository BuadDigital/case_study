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
        await using var contexts = CreateContexts();
        var db = contexts.Legacy;
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

        var forms = CreateFormService(contexts);
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
        await using var contexts = CreateContexts();
        var db = contexts.Legacy;
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

        var forms = CreateFormService(contexts);
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
    public async Task Parent_save_rejected_when_parent_form_submitted()
    {
        await using var contexts = CreateContexts();
        var db = contexts.Legacy;
        SeedWorkflow(db);
        db.CaseStudyForms.Add(new CaseStudyForm
        {
            Id = Guid.NewGuid(),
            TaskId = ParentTaskId,
            IsPartyForm = false,
            Status = "submitted",
            AnswersJson = """{"deed_2":"A"}""",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var forms = CreateFormService(contexts);
        var (result, errors) = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new CaseStudyFormDto
            {
                TaskId = ParentTaskId.ToString(),
                Status = "submitted",
                Answers = new Dictionary<string, object?> { ["deed_2"] = "B" },
            });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("لا يمكن تعديله", errors!["_"]);

        var stored = await db.CaseStudyForms.SingleAsync(f => !f.IsPartyForm);
        Assert.Contains("\"A\"", stored.AnswersJson);
    }

    [Fact]
    public async Task Party_save_rejected_when_party_form_locked()
    {
        await using var contexts = CreateContexts();
        var db = contexts.Legacy;
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

        var forms = CreateFormService(contexts);
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

    private static CaseStudyFormService CreateFormService(TestDatabases.ContextSet contexts)
    {
        var db = contexts.Legacy;
        var timeline = new PropertyTimelineService(db);
        var valuation = new ValuationRequestService(
            contexts.Valuation,
            new ValuationOutboxPublisher(
                contexts.Valuation,
                NullLogger<ValuationOutboxPublisher>.Instance),
            new CaseStudyPropertyPoNumberLookup(db));
        var dispatch = new CaseStudyValuationDispatchService(
            db,
            valuation,
            timeline,
            NullLogger<CaseStudyValuationDispatchService>.Instance);
        var workflow = TestInspectorFeeServiceFactory.CreateWorkflow(db);
        return new CaseStudyFormService(db, dispatch, workflow);
    }

    private static TestDatabases.ContextSet CreateContexts() =>
        TestDatabases.Create("case-study-party-lock");

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
