using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;

namespace RealEstateEval.Application.Tests;

public class CaseStudyPartyContributionLockTests
{
    private static readonly Guid PropertyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid ParentTaskId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly Guid AppraisalTaskId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static readonly Guid WorkOrderId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");

    [Fact]
    public async Task Parent_submission_locks_existing_party_forms()
    {
        await using var contexts = CreateContexts();
        var db = contexts.CaseStudy;
        SeedWorkflow(db);
        db.CaseStudyReports.Add(new CaseStudyReport
        {
            Id = Guid.NewGuid(),
            TaskId = AppraisalTaskId,
            IsPartyContribution = true,
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
            new CaseStudyReportDto
            {
                TaskId = ParentTaskId.ToString(),
                PropertyId = PropertyId.ToString(),
                PoNumber = "PO-900",
                Status = "issued",
            });

        Assert.Null(errors);
        var partyContribution = await contexts.CaseStudy.CaseStudyReports.AsNoTracking()
            .SingleAsync(f => f.IsPartyContribution);
        Assert.Equal("issued", partyContribution.Status);
    }

    [Fact]
    public async Task Party_save_rejected_when_parent_form_submitted()
    {
        await using var contexts = CreateContexts();
        var db = contexts.CaseStudy;
        SeedWorkflow(db);
        db.CaseStudyReports.Add(new CaseStudyReport
        {
            Id = Guid.NewGuid(),
            TaskId = ParentTaskId,
            IsPartyContribution = false,
            Status = "issued",
            AnswersJson = "{}",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var forms = CreateFormService(contexts);
        var (result, errors) = await forms.SaveAsync(
            AppraisalTaskId,
            party: true,
            new CaseStudyReportDto
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
        var db = contexts.CaseStudy;
        SeedWorkflow(db);
        db.CaseStudyReports.Add(new CaseStudyReport
        {
            Id = Guid.NewGuid(),
            TaskId = ParentTaskId,
            IsPartyContribution = false,
            Status = "issued",
            AnswersJson = """{"deed_2":"A"}""",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var forms = CreateFormService(contexts);
        var (result, errors) = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new CaseStudyReportDto
            {
                TaskId = ParentTaskId.ToString(),
                Status = "issued",
                Answers = new Dictionary<string, object?> { ["deed_2"] = "B" },
            });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("أعد فتحه أولاً", errors!["_"]);

        var stored = await db.CaseStudyReports.SingleAsync(f => !f.IsPartyContribution);
        Assert.Contains("\"A\"", stored.AnswersJson);
    }

    [Fact]
    public async Task Party_save_rejected_when_party_form_locked()
    {
        await using var contexts = CreateContexts();
        var db = contexts.CaseStudy;
        SeedWorkflow(db);
        db.CaseStudyReports.Add(new CaseStudyReport
        {
            Id = Guid.NewGuid(),
            TaskId = AppraisalTaskId,
            IsPartyContribution = true,
            Status = "issued",
            AnswersJson = "{}",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var forms = CreateFormService(contexts);
        var (result, errors) = await forms.SaveAsync(
            AppraisalTaskId,
            party: true,
            new CaseStudyReportDto
            {
                TaskId = AppraisalTaskId.ToString(),
                Status = "draft",
                Answers = new Dictionary<string, object?> { ["deed_2"] = "B" },
            });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("إغلاق مساهمة الطرف", errors!["_"]);
    }

    [Theory]
    [InlineData("completed", false)]
    [InlineData("done", false)]
    [InlineData("Completed", false)]
    [InlineData("bogus", false)]
    [InlineData("", false)]
    [InlineData("completed", true)]
    [InlineData("done", true)]
    public async Task Save_rejects_a_status_that_would_skip_the_submit_gates(string status, bool party)
    {
        await using var contexts = CreateContexts();
        SeedWorkflow(contexts.CaseStudy);
        var forms = CreateFormService(contexts);
        var taskId = party ? AppraisalTaskId : ParentTaskId;

        var (result, errors) = await forms.SaveAsync(
            taskId,
            party,
            new CaseStudyReportDto { TaskId = taskId.ToString(), Status = status });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("حالة التقرير غير مقبولة", errors!["_"]);
        Assert.Empty(contexts.CaseStudy.CaseStudyReports);
    }

    [Theory]
    [InlineData("new", "new")]
    [InlineData("draft", "draft")]
    [InlineData(" Draft ", "draft")]
    public async Task Save_accepts_new_and_draft_and_stores_them_canonically(string sent, string stored)
    {
        await using var contexts = CreateContexts();
        SeedWorkflow(contexts.CaseStudy);
        var forms = CreateFormService(contexts);

        var (result, errors) = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new CaseStudyReportDto { TaskId = ParentTaskId.ToString(), Status = sent });

        Assert.Null(errors);
        Assert.Equal(stored, result!.Status);
    }

    [Fact]
    public async Task Issue_with_odd_casing_still_locks_party_contributions()
    {
        await using var contexts = CreateContexts();
        var db = contexts.CaseStudy;
        SeedWorkflow(db);
        db.CaseStudyReports.Add(new CaseStudyReport
        {
            Id = Guid.NewGuid(),
            TaskId = AppraisalTaskId,
            IsPartyContribution = true,
            Status = "draft",
            AnswersJson = "{}",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var forms = CreateFormService(contexts);
        var (result, errors) = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new CaseStudyReportDto
            {
                TaskId = ParentTaskId.ToString(),
                PropertyId = PropertyId.ToString(),
                PoNumber = "PO-900",
                Status = "ISSUED",
            });

        Assert.Null(errors);
        Assert.Equal("issued", result!.Status);
        var partyContribution = await contexts.CaseStudy.CaseStudyReports.AsNoTracking()
            .SingleAsync(f => f.IsPartyContribution);
        Assert.Equal("issued", partyContribution.Status);
    }

    [Fact]
    public async Task A_submitted_form_cannot_be_moved_back_to_draft()
    {
        await using var contexts = CreateContexts();
        SeedWorkflow(contexts.CaseStudy);
        var forms = CreateFormService(contexts);
        var first = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new CaseStudyReportDto
            {
                TaskId = ParentTaskId.ToString(),
                PropertyId = PropertyId.ToString(),
                Status = "issued",
            });
        Assert.Null(first.Errors);

        var (result, errors) = await forms.SaveAsync(
            ParentTaskId,
            party: false,
            new CaseStudyReportDto { TaskId = ParentTaskId.ToString(), Status = "draft" });

        Assert.Null(result);
        Assert.Contains("أعد فتحه أولاً", errors!["_"]);
    }

    private static CaseStudyReportService CreateFormService(TestDatabases.ContextSet contexts)
    {
        var db = contexts.CaseStudy;
        var workflow = TestInspectorFeeServiceFactory.CreateWorkflow(db);
        return new CaseStudyReportService(new CaseStudyReportRepository(contexts.CaseStudy), workflow);
    }

    private static TestDatabases.ContextSet CreateContexts() =>
        TestDatabases.Create("case-study-party-lock");

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
