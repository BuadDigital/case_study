using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FinancialReportServiceTests
{
    [Fact]
    public async Task GetSummaryAsync_aggregates_in_database_without_materializing_entities()
    {
        var materialization = new EntityMaterializationCounter();
        await using var db = CreateDb(materialization);
        await SeedAsync(db);
        db.ChangeTracker.Clear();
        materialization.Reset();

        var summary = await CreateService(db).GetSummaryAsync();

        var revenue = Assert.Single(summary.RevenueRows, row => row.Po == "PO-100");
        Assert.Equal(1, revenue.Billed);
        Assert.Equal(1, revenue.Excluded);
        Assert.Equal("progress", revenue.Status);
        Assert.Equal("INV-100", revenue.InvoiceNumber);

        var keyRevenue = Assert.Single(
            summary.RevenueRows,
            row => row.Po == "أتعاب استلام مفاتيح");
        Assert.Equal(1, keyRevenue.Billed);
        Assert.Equal(0, keyRevenue.Excluded);

        var cost = Assert.Single(summary.CostRows, row => row.Name == "inspector-1");
        Assert.Equal("inspector-1", cost.Name);
        Assert.Equal("free", cost.Type);
        Assert.Equal("معاينة", cost.Category);
        Assert.NotEqual("—", cost.Cost);

        Assert.Equal(0, materialization.Count<InspectorFeeLedger>());
        Assert.Equal(0, materialization.Count<WorkOrder>());
        Assert.Equal(0, materialization.Count<WorkOrderProperty>());
        Assert.Equal(0, materialization.Count<PoEnfazRevenueLine>());
        Assert.Equal(0, materialization.Count<KeyReceiptFeeCharge>());
        Assert.Equal(0, materialization.Count<CourtVisitFeeCharge>());
        Assert.Empty(db.ChangeTracker.Entries());
    }

    /// <summary>
    /// A disputed line has no agreed amount yet, so counting it would overstate external costs and
    /// understate the margin. The exclusion has to hold for the aggregates, not just the fee list.
    /// </summary>
    [Fact]
    public async Task Disputed_lines_stay_out_of_the_cost_aggregates()
    {
        await using var db = CreateDb(new EntityMaterializationCounter());
        await SeedAsync(db);
        db.ChangeTracker.Clear();
        var before = await CreateService(db).GetSummaryAsync();

        var disputedTaskId = Guid.NewGuid();
        var completedPropertyId = await db.WorkflowTasks
            .Where(task => task.Kind == WorkflowTaskKind.CaseStudyProperty)
            .Select(task => task.PropertyId)
            .FirstAsync();
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-100",
            now,
            status: WorkflowTaskStatus.Completed,
            id: disputedTaskId,
            propertyId: completedPropertyId));
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = disputedTaskId,
            PoNumber = "PO-100",
            PropertyId = completedPropertyId,
            AssigneeId = "inspector-disputed",
            InspectorType = InspectorFeeRules.TypeCooperatorIndividual,
            AgreedFeeSar = 4_000m,
            BillingStatus = InspectorFeeBillingStatus.Disputed,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var after = await CreateService(db).GetSummaryAsync();

        Assert.DoesNotContain(after.CostRows, row => row.Name == "inspector-disputed");
        Assert.Equal(before.ExternalCostsTotal, after.ExternalCostsTotal);
        Assert.Equal(before.ProfitMarginTotal, after.ProfitMarginTotal);
        Assert.Equal(before.PendingPayablesTotal, after.PendingPayablesTotal);
    }

    private static FinancialReportService CreateService(ApplicationDbContext db)
    {
        var cache = new ApiResponseCache(
            new NullDistributedCache(),
            Options.Create(new RedisCacheOptions { Enabled = false }),
            NullLogger<ApiResponseCache>.Instance);
        return new FinancialReportService(db, cache);
    }

    private static ApplicationDbContext CreateDb(EntityMaterializationCounter materialization)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"financial-summary-{Guid.NewGuid():N}")
            .AddInterceptors(materialization)
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task SeedAsync(ApplicationDbContext db)
    {
        var workOrderId = Guid.NewGuid();
        var completedPropertyId = Guid.NewGuid();
        var incompletePropertyId = Guid.NewGuid();
        var feeTaskId = Guid.NewGuid();
        var excludedFeeTaskId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        db.WorkOrders.Add(new WorkOrder
        {
            Id = workOrderId,
            PoNumber = "PO-100",
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(5)),
            CreatedAtUtc = now,
            Properties =
            [
                new WorkOrderProperty
                {
                    Id = completedPropertyId,
                    DeedNumber = "D-1",
                    City = "Riyadh",
                    District = "D",
                    Classification = "C",
                    PropertyType = "T",
                },
                new WorkOrderProperty
                {
                    Id = incompletePropertyId,
                    DeedNumber = "D-2",
                    City = "Riyadh",
                    District = "D",
                    Classification = "C",
                    PropertyType = "T",
                },
            ],
        });
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-100",
                now,
                status: WorkflowTaskStatus.Completed,
                propertyId: completedPropertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection,
                "PO-100",
                now,
                status: WorkflowTaskStatus.Completed,
                id: feeTaskId,
                propertyId: completedPropertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection,
                "PO-100",
                now,
                status: WorkflowTaskStatus.Completed,
                id: excludedFeeTaskId,
                propertyId: incompletePropertyId));
        db.InspectorFeeLedgers.AddRange(
            new InspectorFeeLedger
            {
                WorkflowTaskId = feeTaskId,
                PoNumber = "PO-100",
                PropertyId = completedPropertyId,
                AssigneeId = "inspector-1",
                InspectorType = InspectorFeeRules.TypeCooperatorIndividual,
                AgreedFeeSar = 500m,
                SupervisorDiscountSar = 50m,
                BillingStatus = InspectorFeeBillingStatus.Disbursed,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            },
            new InspectorFeeLedger
            {
                WorkflowTaskId = excludedFeeTaskId,
                PoNumber = "PO-100",
                PropertyId = incompletePropertyId,
                AssigneeId = "inspector-2",
                InspectorType = InspectorFeeRules.TypeCooperatorIndividual,
                AgreedFeeSar = 900m,
                BillingStatus = InspectorFeeBillingStatus.AtFinance,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        db.PoEnfazRevenueLines.Add(new PoEnfazRevenueLine
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-100",
            PropertyId = completedPropertyId,
            CaseStudyFeeSar = 1_000m,
            SurveyFeeSar = 500m,
            IncludedInBilling = true,
            UpdatedAtUtc = now,
        });
        db.PoEnfazInvoices.Add(new PoEnfazInvoice
        {
            PoNumber = "PO-100",
            InvoiceNumber = "INV-100",
            IssuedAtUtc = now,
        });
        db.KeyReceiptFeeCharges.Add(new KeyReceiptFeeCharge
        {
            Id = Guid.NewGuid(),
            EnvelopeId = Guid.NewGuid(),
            RequestNumber = "REQ-1",
            AmountSar = 100m,
            CollectionStatus = KeyReceiptFeeStatuses.Collected,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.CourtVisitFeeCharges.Add(new CourtVisitFeeCharge
        {
            Id = Guid.NewGuid(),
            OperationsTaskId = Guid.NewGuid(),
            TaskDisplayId = "VISIT-1",
            AmountSar = 75m,
            Status = CourtVisitFeeStatuses.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        await db.SaveChangesAsync();
    }

    private sealed class EntityMaterializationCounter : IMaterializationInterceptor
    {
        private readonly Dictionary<Type, int> _counts = [];

        public object InitializedInstance(
            MaterializationInterceptionData materializationData,
            object entity)
        {
            _counts[entity.GetType()] = Count(entity.GetType()) + 1;
            return entity;
        }

        public int Count<T>() => Count(typeof(T));

        public void Reset() => _counts.Clear();

        private int Count(Type type) => _counts.GetValueOrDefault(type);
    }

    private sealed class NullDistributedCache : IDistributedCache
    {
        public byte[]? Get(string key) => null;
        public Task<byte[]?> GetAsync(string key, CancellationToken token = default) =>
            Task.FromResult<byte[]?>(null);
        public void Refresh(string key) { }
        public Task RefreshAsync(string key, CancellationToken token = default) =>
            Task.CompletedTask;
        public void Remove(string key) { }
        public Task RemoveAsync(string key, CancellationToken token = default) =>
            Task.CompletedTask;
        public void Set(string key, byte[] value, DistributedCacheEntryOptions options) { }
        public Task SetAsync(
            string key,
            byte[] value,
            DistributedCacheEntryOptions options,
            CancellationToken token = default) => Task.CompletedTask;
    }
}
