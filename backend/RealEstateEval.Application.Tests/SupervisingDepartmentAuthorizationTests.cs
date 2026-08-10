using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

public class SupervisingDepartmentAuthorizationTests
{
    [Theory]
    [InlineData(WorkflowTaskKind.GovernmentReview, SupervisingDepartments.CaseStudy)]
    [InlineData(WorkflowTaskKind.FieldInspection, SupervisingDepartments.CaseStudy)]
    [InlineData(WorkflowTaskKind.EngineeringSurvey, SupervisingDepartments.Valuation)]
    public void Financial_items_follow_the_transaction_department(
        WorkflowTaskKind kind,
        string expected) =>
        Assert.Equal(expected, SupervisingDepartments.ForTaskKind(kind));

    [Theory]
    [InlineData("قسم دراسة الحالة", SupervisingDepartments.CaseStudy)]
    [InlineData("case_study", SupervisingDepartments.CaseStudy)]
    [InlineData("قسم تقييم الأفراد", SupervisingDepartments.Valuation)]
    [InlineData("valuation", SupervisingDepartments.Valuation)]
    public void Historical_profile_labels_normalize_to_canonical_departments(
        string stored,
        string expected) =>
        Assert.Equal(expected, SupervisingDepartments.NormalizeProfileValue(stored));

    [Fact]
    public void Ambiguous_administration_labels_do_not_normalize() =>
        Assert.Null(SupervisingDepartments.NormalizeProfileValue("إدارة التقييم العقاري"));

    [Theory]
    [InlineData("case-specialist", null, SupervisingDepartments.CaseStudy)]
    [InlineData("field-inspector", "anything", SupervisingDepartments.Valuation)]
    [InlineData("financial-officer", SupervisingDepartments.CaseStudy, SupervisingDepartments.Finance)]
    public void Non_supervisor_departments_are_derived_from_role(
        string roleId,
        string? requested,
        string expected)
    {
        var (department, error) = SupervisingDepartments.ResolveForStaff(roleId, requested);
        Assert.Null(error);
        Assert.Equal(expected, department);
    }

    [Fact]
    public void Section_supervisors_must_choose_a_selectable_department()
    {
        var (missing, missingError) = SupervisingDepartments.ResolveForStaff(
            "section-supervisor",
            null);
        Assert.Null(missing);
        Assert.NotNull(missingError);

        var (finance, financeError) = SupervisingDepartments.ResolveForStaff(
            "section-supervisor",
            SupervisingDepartments.Finance);
        Assert.Null(finance);
        Assert.NotNull(financeError);

        var (ok, error) = SupervisingDepartments.ResolveForStaff(
            "section-supervisor",
            SupervisingDepartments.Valuation);
        Assert.Null(error);
        Assert.Equal(SupervisingDepartments.Valuation, ok);
    }

    [Fact]
    public async Task A_supervisor_without_a_department_sees_an_empty_queue()
    {
        await using var db = CreateDb();
        SeedLedger(db, SupervisingDepartments.CaseStudy);
        SeedLedger(db, SupervisingDepartments.Valuation);
        await db.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db);

        var summary = await service.GetSummaryAsync(
            assigneeId: null,
            workflowTaskId: null,
            submittedOnly: false,
            supervisingDepartment: SupervisingDepartments.Unassigned);

        Assert.Empty(summary.Rows);
    }

    [Fact]
    public async Task A_supervisor_cannot_discount_another_departments_item()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, SupervisingDepartments.Valuation);
        await db.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db);
        var request = new PatchInspectorFeeRequest
        {
            SupervisorDiscountSar = 100m,
            DiscountReason = "حسم إشرافي",
        };

        var denied = await service.PatchAsync(
            taskId,
            request,
            actorDepartment: SupervisingDepartments.CaseStudy);
        Assert.Null(denied);
        Assert.Equal(0m, (await db.InspectorFeeLedgers.SingleAsync()).SupervisorDiscountSar);

        var accepted = await service.PatchAsync(
            taskId,
            request,
            actorDepartment: SupervisingDepartments.Valuation);
        Assert.NotNull(accepted);
        Assert.Equal(100m, accepted!.SupervisorDiscountSar);
    }

    [Fact]
    public async Task Only_the_transactions_department_can_resolve_its_dispute()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(
            db,
            SupervisingDepartments.Valuation,
            InspectorFeeBillingStatus.Disputed,
            discount: 100m);
        await db.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db);
        var request = new InspectorFeeTransitionRequest
        {
            Action = InspectorFeeActions.ResolveDispute,
            Reason = "اعتماد الحسم",
        };

        var (_, deniedError) = await service.TransitionAsync(
            taskId,
            request,
            "case-supervisor",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.CaseStudy);
        Assert.Contains("قسماً آخر", deniedError);

        var (resolved, error) = await service.TransitionAsync(
            taskId,
            request,
            "valuation-supervisor",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.Valuation);
        Assert.Null(error);
        Assert.NotNull(resolved);
    }

    /// <summary>
    /// The batch endpoint walks the same transition code per row, so a supervisor must not be able to
    /// smuggle another department's line through by submitting it alongside their own.
    /// </summary>
    [Fact]
    public async Task A_batch_transition_is_checked_department_by_department()
    {
        await using var db = CreateDb();
        var ownTaskId = SeedLedger(
            db,
            SupervisingDepartments.CaseStudy,
            InspectorFeeBillingStatus.SupReview);
        var otherTaskId = SeedLedger(
            db,
            SupervisingDepartments.Valuation,
            InspectorFeeBillingStatus.SupReview);
        await db.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db);

        var result = await service.BatchTransitionAsync(
            new BatchInspectorFeeTransitionRequest
            {
                WorkflowTaskIds = [ownTaskId.ToString(), otherTaskId.ToString()],
                Action = InspectorFeeActions.ApproveToFinance,
            },
            "case-supervisor",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.CaseStudy);

        var succeeded = Assert.Single(result.Succeeded);
        Assert.Equal(ownTaskId.ToString(), succeeded.WorkflowTaskId);
        var failure = Assert.Single(result.Failed);
        Assert.Equal(otherTaskId.ToString(), failure.WorkflowTaskId);
        Assert.Contains("قسماً آخر", failure.Error);
    }

    [Fact]
    public async Task Executives_can_manage_items_across_departments()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, SupervisingDepartments.Valuation);
        await db.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db);

        var row = await service.PatchAsync(
            taskId,
            new PatchInspectorFeeRequest
            {
                SupervisorDiscountSar = 50m,
                DiscountReason = "اعتماد الإدارة",
            },
            actorDepartment: SupervisingDepartments.CaseStudy,
            canManageAllDepartments: true);

        Assert.NotNull(row);
        Assert.Equal(50m, row!.SupervisorDiscountSar);
    }

    [Fact]
    public async Task A_section_supervisors_queue_contains_only_their_department()
    {
        await using var db = CreateDb();
        SeedLedger(db, SupervisingDepartments.CaseStudy);
        SeedLedger(db, SupervisingDepartments.Valuation);
        await db.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db);

        var summary = await service.GetSummaryAsync(
            assigneeId: null,
            workflowTaskId: null,
            submittedOnly: false,
            supervisingDepartment: SupervisingDepartments.CaseStudy);

        var row = Assert.Single(summary.Rows);
        Assert.Equal(SupervisingDepartments.CaseStudy, row.SupervisingDepartment);
    }

    private static Guid SeedLedger(
        ApplicationDbContext db,
        string department,
        string status = InspectorFeeBillingStatus.Draft,
        decimal discount = 0m)
    {
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-DEPT",
            now,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب",
            assigneeId: "office-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-DEPT",
            AssigneeId = "office-1",
            InspectorType = "متعاون شركة",
            SupervisingDepartment = department,
            AgreedFeeSar = 1000m,
            SupervisorDiscountSar = discount,
            DiscountReason = discount > 0 ? "حسم" : null,
            BillingStatus = status,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        return taskId;
    }

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"supervising-department-{Guid.NewGuid():N}")
            .Options);
}
