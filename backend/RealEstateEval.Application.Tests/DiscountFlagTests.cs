using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Financial.Application.Contracts;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A specialist flag is only a proposal. Money moves when the transaction supervisor approves it.
/// </summary>
public class DiscountFlagTests
{
    [Fact]
    public async Task Approving_a_flag_applies_the_discount_to_the_ledger()
    {
        await using var store = CreateStore();
        var taskId = SeedLedger(store);
        await store.SaveAsync();
        var service = new DiscountFlagService(store.Fin, new CaseStudyLookup(store.CaseStudy));

        var (created, createError) = await service.CreateAsync(
            new CreateDiscountFlagRequest
            {
                TransactionKey = "PO-FLAG",
                WorkflowTaskId = taskId.ToString(),
                TargetAssigneeId = "insp-1",
                Reason = "تأخير معاينة",
                ProposedDiscountSar = 75m,
            },
            "specialist-1");
        Assert.Null(createError);

        var (approved, approveError) = await service.ApproveAsync(
            Guid.Parse(created!.Id),
            new ResolveDiscountFlagRequest(),
            "supervisor-1",
            actorDepartment: SupervisingDepartments.Valuation,
            canManageAllDepartments: false);

        Assert.Null(approveError);
        Assert.Equal(DiscountFlagStatuses.Approved, approved!.Status);
        var ledger = await store.Fin.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(75m, ledger.SupervisorDiscountSar);
        Assert.Equal("تأخير معاينة", ledger.DiscountReason);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, ledger.BillingStatus);
    }

    [Fact]
    public async Task A_flag_does_not_change_money_until_approved()
    {
        await using var store = CreateStore();
        var taskId = SeedLedger(store);
        await store.SaveAsync();

        await new DiscountFlagService(store.Fin, new CaseStudyLookup(store.CaseStudy)).CreateAsync(
            new CreateDiscountFlagRequest
            {
                TransactionKey = "PO-FLAG",
                WorkflowTaskId = taskId.ToString(),
                TargetAssigneeId = "insp-1",
                Reason = "اقتراح",
                ProposedDiscountSar = 100m,
            },
            "specialist-1");

        var ledger = await store.Fin.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(0m, ledger.SupervisorDiscountSar);
        Assert.Equal(InspectorFeeBillingStatus.Draft, ledger.BillingStatus);
    }

    [Fact]
    public async Task Only_the_transaction_department_supervisor_can_approve()
    {
        await using var store = CreateStore();
        var taskId = SeedLedger(store);
        await store.SaveAsync();
        var service = new DiscountFlagService(store.Fin, new CaseStudyLookup(store.CaseStudy));

        var (created, _) = await service.CreateAsync(
            new CreateDiscountFlagRequest
            {
                TransactionKey = "PO-FLAG",
                WorkflowTaskId = taskId.ToString(),
                TargetAssigneeId = "insp-1",
                Reason = "تأخير",
                ProposedDiscountSar = 40m,
            },
            "specialist-1");

        var (row, error) = await service.ApproveAsync(
            Guid.Parse(created!.Id),
            new ResolveDiscountFlagRequest(),
            "other-supervisor",
            actorDepartment: SupervisingDepartments.CaseStudy,
            canManageAllDepartments: false);

        Assert.Null(row);
        Assert.Contains("قسماً آخر", error);
        var ledger = await store.Fin.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(0m, ledger.SupervisorDiscountSar);
        Assert.Equal(DiscountFlagStatuses.Pending, (await store.Fin.DiscountFlags.AsNoTracking()
            .SingleAsync(f => f.Id == Guid.Parse(created.Id))).Status);
    }

    private static Guid SeedLedger(Store store)
    {
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        store.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-FLAG",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "insp-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        store.Fin.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-FLAG",
            AssigneeId = "insp-1",
            InspectorType = InspectorFeeRules.TypeEmployee,
            SupervisingDepartment = SupervisingDepartments.Valuation,
            AgreedFeeSar = 500m,
            BillingStatus = InspectorFeeBillingStatus.Draft,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        return taskId;
    }

    private static Store CreateStore()
    {
        var name = $"discount-flag-{Guid.NewGuid():N}";
        var root = new InMemoryDatabaseRoot();
        return new Store(
            new FinancialDbContext(
                new DbContextOptionsBuilder<FinancialDbContext>()
                    .UseInMemoryDatabase(name, root)
                    .Options),
            new CaseStudyDbContext(
                new DbContextOptionsBuilder<CaseStudyDbContext>()
                    .UseInMemoryDatabase(name, root)
                    .Options));
    }

    private sealed class Store(FinancialDbContext fin, CaseStudyDbContext caseStudy) : IAsyncDisposable
    {
        public FinancialDbContext Fin { get; } = fin;
        public CaseStudyDbContext CaseStudy { get; } = caseStudy;

        public async Task SaveAsync()
        {
            await CaseStudy.SaveChangesAsync();
            await Fin.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await Fin.DisposeAsync();
            await CaseStudy.DisposeAsync();
        }
    }
}
