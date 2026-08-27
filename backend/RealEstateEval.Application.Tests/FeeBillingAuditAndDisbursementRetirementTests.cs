using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class FeeBillingAuditAndDisbursementRetirementTests
{
    [Fact]
    public async Task Successful_transition_writes_general_audit_log()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, InspectorFeeBillingStatus.AtFinance);
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();
        var ledgerId = await db.Financial.InspectorFeeLedgers.AsNoTracking()
            .Where(l => l.WorkflowTaskId == taskId)
            .Select(l => l.Id)
            .SingleAsync();

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db.CaseStudy).TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.Suspend,
                Reason = "بانتظار تسوية",
            },
            "supervisor-1",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.Valuation);

        Assert.Null(error);
        Assert.NotNull(row);

        var audit = Assert.Single(db.Financial.AuditLogs);
        Assert.Equal("supervisor-1", audit.ActorId);
        Assert.Equal("FEE_BILLING_TRANSITION", audit.Action);
        Assert.Equal("inspector_fee_ledger", audit.EntityType);
        Assert.Equal(ledgerId.ToString(), audit.EntityId);

        using var before = JsonDocument.Parse(audit.BeforeJson);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal(
            InspectorFeeBillingStatus.AtFinance,
            before.RootElement.GetProperty("billingStatus").GetString());
        Assert.Equal(
            InspectorFeeBillingStatus.Suspended,
            after.RootElement.GetProperty("billingStatus").GetString());
    }

    [Fact]
    public async Task Failed_authorization_writes_no_audit_log()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, InspectorFeeBillingStatus.AtFinance);
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db.CaseStudy).TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.Suspend,
                Reason = "محاولة غير مصرّح بها",
            },
            "finance-1",
            actorAssigneeId: null,
            isOperationsManager: false,
            isFinancialOfficer: true,
            actorDepartment: SupervisingDepartments.Finance);

        Assert.Null(row);
        Assert.NotNull(error);
        Assert.Empty(db.Financial.AuditLogs);
    }

    [Fact]
    public async Task Create_disbursement_batch_is_always_rejected_without_writing_rows()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, InspectorFeeBillingStatus.AtFinance);
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        var result = await TestInspectorFeeServiceFactory.Create(db.CaseStudy).CreateDisbursementBatchAsync(
            new CreateDisbursementBatchRequest
            {
                WorkflowTaskIds = [taskId.ToString()],
            },
            "party-1",
            "office-1");

        Assert.Empty(result.Rows);
        Assert.NotEmpty(result.Failed);
        Assert.Contains("كشف الأطراف", result.Failed[0].Error);
        Assert.Empty(db.Financial.DisbursementBatches);
        Assert.Empty(db.Financial.AuditLogs);

        var ledger = await db.Financial.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, ledger.BillingStatus);
        Assert.Null(ledger.DisbursementBatchId);
    }

    private static Guid SeedLedger(TestDatabases.ContextSet db, string status)
    {
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-AUDIT",
            now,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب",
            assigneeId: "office-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-AUDIT",
            AssigneeId = "office-1",
            InspectorType = "متعاون شركة",
            SupervisingDepartment = SupervisingDepartments.Valuation,
            AgreedFeeSar = 1_000m,
            BillingStatus = status,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        return taskId;
    }

    private static TestDatabases.ContextSet CreateDb() =>
        TestDatabases.Create("fee-audit-retire");
}
