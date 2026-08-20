using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FinancialReportServiceTests
{
    [Fact]
    public async Task GetSummaryAsync_aggregates_in_database_without_materializing_entities()
    {
        var materialization = new EntityMaterializationCounter();
        await using var store = CreateStore(materialization);
        await SeedAsync(store);
        store.Fin.ChangeTracker.Clear();
        store.CaseStudy.ChangeTracker.Clear();
        materialization.Reset();

        var summary = await CreateService(store).GetSummaryAsync();

        var revenue = Assert.Single(summary.RevenueRows, row => row.Po == "PO-100");
        Assert.Equal(1, revenue.Billed);
        Assert.Equal(1, revenue.Excluded);
        Assert.Equal(FinancialRevenueRowStatuses.Progress, revenue.Status);
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
        Assert.Empty(store.Fin.ChangeTracker.Entries());
    }

 /// <summary>
 /// A disputed line has no agreed amount yet, so counting it would overstate external costs and
 /// understate the margin. The exclusion has to hold for the aggregates, not just the fee list.
 /// </summary>
    [Fact]
    public async Task Disputed_lines_stay_out_of_the_cost_aggregates()
    {
        await using var store = CreateStore(new EntityMaterializationCounter());
        await SeedAsync(store);
        store.Fin.ChangeTracker.Clear();
        store.CaseStudy.ChangeTracker.Clear();
        var before = await CreateService(store).GetSummaryAsync();

        var disputedTaskId = Guid.NewGuid();
        var completedPropertyId = await store.CaseStudy.WorkflowTasks
            .Where(task => task.Kind == WorkflowTaskKind.CaseStudyProperty)
            .Select(task => task.PropertyId)
            .FirstAsync();
        var now = DateTime.UtcNow;
        store.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-100",
            now,
            status: WorkflowTaskStatus.Completed,
            id: disputedTaskId,
            propertyId: completedPropertyId));
        store.Fin.InspectorFeeLedgers.Add(new InspectorFeeLedger
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
        await store.CaseStudy.SaveChangesAsync();
        await store.Fin.SaveChangesAsync();
        store.Fin.ChangeTracker.Clear();
        store.CaseStudy.ChangeTracker.Clear();

        var after = await CreateService(store).GetSummaryAsync();

        Assert.DoesNotContain(after.CostRows, row => row.Name == "inspector-disputed");
        Assert.Equal(before.ExternalCostsTotal, after.ExternalCostsTotal);
        Assert.Equal(before.ProfitMarginTotal, after.ProfitMarginTotal);
        Assert.Equal(before.PendingPayablesTotal, after.PendingPayablesTotal);
    }

    private static FinancialReportService CreateService(Store store)
    {
        var cache = new ApiResponseCache(
            new NullDistributedCache(),
            Options.Create(new RedisCacheOptions { Enabled = false }),
            NullLogger<ApiResponseCache>.Instance);
        return new FinancialReportService(
            store.Fin,
            new CaseStudyLookup(store.CaseStudy),
            new IdentityDirectory(store.Identity),
            cache);
    }

    private static Store CreateStore(EntityMaterializationCounter materialization)
    {
        var name = $"financial-summary-{Guid.NewGuid():N}";
        var root = new InMemoryDatabaseRoot();
        return new Store(
            new FinancialDbContext(
                new DbContextOptionsBuilder<FinancialDbContext>()
                    .UseInMemoryDatabase(name, root)
                    .AddInterceptors(materialization)
                    .Options),
            new CaseStudyDbContext(
                new DbContextOptionsBuilder<CaseStudyDbContext>()
                    .UseInMemoryDatabase(name, root)
                    .AddInterceptors(materialization)
                    .Options),
            new IdentityDbContext(
                new DbContextOptionsBuilder<IdentityDbContext>()
                    .UseInMemoryDatabase(name, root)
                    .AddInterceptors(materialization)
                    .Options));
    }

    private static async Task SeedAsync(Store store)
    {
        var workOrderId = Guid.NewGuid();
        var completedPropertyId = Guid.NewGuid();
        var incompletePropertyId = Guid.NewGuid();
        var feeTaskId = Guid.NewGuid();
        var excludedFeeTaskId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        store.CaseStudy.WorkOrders.Add(new WorkOrder
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
        store.CaseStudy.WorkflowTasks.AddRange(
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
        store.Fin.InspectorFeeLedgers.AddRange(
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
        store.Fin.PoEnfazRevenueLines.Add(new PoEnfazRevenueLine
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-100",
            PropertyId = completedPropertyId,
            CaseStudyFeeSar = 1_000m,
            SurveyFeeSar = 500m,
            IncludedInBilling = true,
            UpdatedAtUtc = now,
        });
        store.Fin.PoEnfazInvoices.Add(new PoEnfazInvoice
        {
            PoNumber = "PO-100",
            InvoiceNumber = "INV-100",
            IssuedAtUtc = now,
        });
        store.Fin.KeyReceiptFeeCharges.Add(new KeyReceiptFeeCharge
        {
            Id = Guid.NewGuid(),
            EnvelopeId = Guid.NewGuid(),
            RequestNumber = "REQ-1",
            AmountSar = 100m,
            CollectionStatus = KeyReceiptFeeStatuses.Collected,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        store.Fin.CourtVisitFeeCharges.Add(new CourtVisitFeeCharge
        {
            Id = Guid.NewGuid(),
            OperationsTaskId = Guid.NewGuid(),
            TaskDisplayId = "VISIT-1",
            AmountSar = 75m,
            Status = CourtVisitFeeStatuses.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        await store.CaseStudy.SaveChangesAsync();
        await store.Fin.SaveChangesAsync();
    }

    private sealed class Store(
        FinancialDbContext fin,
        CaseStudyDbContext caseStudy,
        IdentityDbContext identity) : IAsyncDisposable
    {
        public FinancialDbContext Fin { get; } = fin;
        public CaseStudyDbContext CaseStudy { get; } = caseStudy;
        public IdentityDbContext Identity { get; } = identity;

        public async ValueTask DisposeAsync()
        {
            await Fin.DisposeAsync();
            await CaseStudy.DisposeAsync();
            await Identity.DisposeAsync();
        }
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
