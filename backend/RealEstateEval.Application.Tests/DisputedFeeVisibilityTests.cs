using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A line under pricing dispute belongs to operations, and finance must not see it at all — not in
/// the list, and not in the totals it drives. The exclusion used to be applied only when generating a
/// billing statement, which left the plain list and the queue counts leaking it.
/// </summary>
public class DisputedFeeVisibilityTests
{
    private static readonly Guid DisputedTaskId = Guid.Parse("dddddddd-0000-0000-0000-000000000001");
    private static readonly Guid ReadyTaskId = Guid.Parse("dddddddd-0000-0000-0000-000000000002");

    [Fact]
    public async Task Finance_sees_neither_the_disputed_row_nor_its_money()
    {
        await using var db = CreateDb();
        await SeedAsync(db);

        var summary = await TestInspectorFeeServiceFactory.Create(db).GetSummaryAsync(
            assigneeId: null,
            workflowTaskId: null,
            submittedOnly: false,
            hideDisputed: true);

        Assert.DoesNotContain(
            summary.Rows,
            r => r.BillingStatus == InspectorFeeBillingStatus.Disputed);
        Assert.Single(summary.Rows);
        Assert.Equal(ReadyTaskId.ToString(), summary.Rows[0].WorkflowTaskId);

        // The disputed 900 must not reach finance through the totals either.
        Assert.Equal(450m, summary.AtFinanceSar);
    }

    /// <summary>
    /// Operations resolves the dispute, so the same query must still return it for them. Hiding it
    /// from everyone would strand the line with nobody able to act on it.
    /// </summary>
    [Fact]
    public async Task Operations_still_sees_the_disputed_row()
    {
        await using var db = CreateDb();
        await SeedAsync(db);

        var summary = await TestInspectorFeeServiceFactory.Create(db).GetSummaryAsync(
            assigneeId: null,
            workflowTaskId: null,
            submittedOnly: false,
            hideDisputed: false);

        Assert.Equal(2, summary.Rows.Count);
        Assert.Contains(
            summary.Rows,
            r => r.BillingStatus == InspectorFeeBillingStatus.Disputed);
    }

    /// <summary>
    /// Filtering explicitly for disputed while hidden must return nothing rather than override the
    /// exclusion — otherwise the rule is one query parameter away from being bypassed.
    /// </summary>
    [Fact]
    public async Task Asking_for_disputed_explicitly_does_not_bypass_the_exclusion()
    {
        await using var db = CreateDb();
        await SeedAsync(db);

        var summary = await TestInspectorFeeServiceFactory.Create(db).GetSummaryAsync(
            assigneeId: null,
            workflowTaskId: null,
            submittedOnly: false,
            billingStatus: InspectorFeeBillingStatus.Disputed,
            hideDisputed: true);

        Assert.Empty(summary.Rows);
    }

    private static async Task SeedAsync(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.AddRange(
            SurveyTask(DisputedTaskId, "PO-DIS"),
            SurveyTask(ReadyTaskId, "PO-DIS"));
        db.InspectorFeeLedgers.AddRange(
            Ledger(DisputedTaskId, InspectorFeeBillingStatus.Disputed, 900m, now),
            Ledger(ReadyTaskId, InspectorFeeBillingStatus.AtFinance, 450m, now));
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Engineering-survey ledgers become visible on accrual alone, which keeps the fixture free of
    /// the completed-case-study gate that other party fees sit behind.
    /// </summary>
    private static WorkflowTask SurveyTask(Guid id, string poNumber) =>
        WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            poNumber,
            DateTime.UtcNow,
            status: WorkflowTaskStatus.Completed,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب هندسي",
            id: id,
            assigneeId: "eng-office-1");

    private static InspectorFeeLedger Ledger(
        Guid taskId,
        string billingStatus,
        decimal agreedFeeSar,
        DateTime now) =>
        new()
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-DIS",
            AssigneeId = "eng-office-1",
            InspectorType = "متعاون شركة",
            AgreedFeeSar = agreedFeeSar,
            BillingStatus = billingStatus,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"disputed-visibility-{Guid.NewGuid():N}")
            .Options);
}
