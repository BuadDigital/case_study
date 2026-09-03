using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class PropertyComparableLinkServiceTests
{
    [Fact]
    public async Task LinkAsync_rejects_unknown_property()
    {
        await using var db = CreateDb();
        var comparableId = await SeedComparableAsync(db, active: true);
        var missingPropertyId = Guid.NewGuid();
        var service = new PropertyComparableLinkService(db, new FakeCaseStudyLookup(existingPropertyId: null));

        var (_, errors) = await service.LinkAsync(
            new LinkPropertyComparableRequest
            {
                PropertyId = missingPropertyId,
                ComparablePropertyId = comparableId,
            },
            "user-1");

        Assert.NotNull(errors);
        Assert.Equal("العقار غير موجود", errors!["propertyId"]);
    }

    [Fact]
    public async Task LinkAsync_rejects_inactive_comparable()
    {
        await using var db = CreateDb();
        var propertyId = Guid.NewGuid();
        var comparableId = await SeedComparableAsync(db, active: false);
        var service = new PropertyComparableLinkService(db, new FakeCaseStudyLookup(propertyId));

        var (_, errors) = await service.LinkAsync(
            new LinkPropertyComparableRequest
            {
                PropertyId = propertyId,
                ComparablePropertyId = comparableId,
            },
            "user-1");

        Assert.NotNull(errors);
        Assert.Contains("comparablePropertyId", errors!.Keys);
    }

    [Fact]
    public async Task LinkAsync_links_and_is_idempotent()
    {
        await using var db = CreateDb();
        var propertyId = Guid.NewGuid();
        var comparableId = await SeedComparableAsync(db, active: true);
        var service = new PropertyComparableLinkService(db, new FakeCaseStudyLookup(propertyId));

        var request = new LinkPropertyComparableRequest
        {
            PropertyId = propertyId,
            ComparablePropertyId = comparableId,
        };

        var (first, firstErrors) = await service.LinkAsync(request, "user-1");
        Assert.Null(firstErrors);
        Assert.Equal(1, first!.LinkedCount);

        var (second, secondErrors) = await service.LinkAsync(request, "user-1");
        Assert.Null(secondErrors);
        Assert.Equal(1, second!.LinkedCount);
    }

    private static async Task<Guid> SeedComparableAsync(ValuationDbContext db, bool active)
    {
        var id = Guid.NewGuid();
        db.ComparableProperties.Add(new ComparableProperty
        {
            Id = id,
            IsActive = active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
            EnteredAtUtc = DateTime.UtcNow,
            TransactionDate = new DateOnly(2026, 1, 1),
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static ValuationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ValuationDbContext>()
            .UseInMemoryDatabase($"comp-link-{Guid.NewGuid():N}")
            .Options);

    private sealed class FakeCaseStudyLookup(Guid? existingPropertyId) : ICaseStudyLookup
    {
        public Task<CaseStudyPropertySnapshotDto?> GetPropertyAsync(
            Guid propertyId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(
                existingPropertyId == propertyId
                    ? new CaseStudyPropertySnapshotDto { Id = propertyId }
                    : null);

        public Task<IReadOnlyList<Guid>> ListCompletedCaseStudyPropertyIdsAsync(
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Guid>>([]);

        public Task<IReadOnlyDictionary<Guid, WorkflowTaskKind>> GetWorkflowTaskKindsAsync(
            IReadOnlyList<Guid> taskIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyDictionary<Guid, WorkflowTaskKind>>(
                new Dictionary<Guid, WorkflowTaskKind>());

        public Task<IReadOnlyList<CaseStudyWorkOrderSummaryDto>> ListWorkOrderSummariesAsync(
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyWorkOrderSummaryDto>>([]);

        public Task<IReadOnlyList<string>> ListPoNumbersByAssigneesAsync(
            IReadOnlyList<string> assigneeIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<string>>([]);

        public Task<CaseStudyValuationPropertyContextDto?> GetValuationPropertyContextAsync(
            Guid propertyId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<CaseStudyValuationPropertyContextDto?>(null);

        public Task<CaseStudyPropertySnapshotDto?> GetPropertyByPoAndDeedAsync(
            string poNumber,
            string deedNumber,
            CancellationToken cancellationToken = default)
            => Task.FromResult<CaseStudyPropertySnapshotDto?>(null);

        public Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByIdsAsync(
            IReadOnlyList<Guid> propertyIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyPropertySnapshotDto>>([]);

        public Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByPoNumbersAsync(
            IReadOnlyList<string> poNumbers,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyPropertySnapshotDto>>([]);

        public Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByRequestNumbersAsync(
            IReadOnlyList<string> requestNumbers,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyPropertySnapshotDto>>([]);

        public Task<string?> GetCaseSpecialistAssigneeAsync(
            Guid propertyId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<string?>(null);

        public Task<IReadOnlyList<CaseStudyGovReviewKeyStatusDto>> ListGovReviewKeyStatusesAsync(
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyGovReviewKeyStatusDto>>([]);

        public Task<CaseStudyWorkflowTaskSnapshotDto?> GetWorkflowTaskAsync(
            Guid taskId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<CaseStudyWorkflowTaskSnapshotDto?>(null);

        public Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByIdsAsync(
            IReadOnlyList<Guid> taskIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>([]);

        public Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByPropertyAsync(
            Guid propertyId,
            IReadOnlyList<WorkflowTaskKind>? kinds = null,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>([]);

        public Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByKindsAsync(
            IReadOnlyList<WorkflowTaskKind> kinds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>([]);

        public Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByPoNumbersAsync(
            IReadOnlyList<string> poNumbers,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>([]);

        public Task<IReadOnlyList<CaseStudyPartyTaskSubmissionSnapshotDto>> ListPartyTaskSubmissionsByTaskIdsAsync(
            IReadOnlyList<Guid> workflowTaskIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyPartyTaskSubmissionSnapshotDto>>([]);

        public Task<IReadOnlyList<CaseStudyFieldInspectionWorkspaceSnapshotDto>> ListFieldInspectionWorkspacesByTaskIdsAsync(
            IReadOnlyList<Guid> workflowTaskIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyFieldInspectionWorkspaceSnapshotDto>>([]);

        public Task<Guid?> GetWorkOrderIdByPoNumberAsync(
            string poNumber,
            CancellationToken cancellationToken = default)
            => Task.FromResult<Guid?>(null);

        public Task<IReadOnlyDictionary<string, DateTime?>> GetWorkOrderReceivedAtByPoNumbersAsync(
            IReadOnlyList<string> poNumbers,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyDictionary<string, DateTime?>>(
                new Dictionary<string, DateTime?>());

        public Task<IReadOnlyList<CaseStudyWorkOrderBillingSnapshotDto>> ListWorkOrdersForBillingAsync(
            int take,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CaseStudyWorkOrderBillingSnapshotDto>>([]);

        public Task<CaseStudyWorkOrderBillingSnapshotDto?> GetWorkOrderForBillingAsync(
            string poNumber,
            CancellationToken cancellationToken = default)
            => Task.FromResult<CaseStudyWorkOrderBillingSnapshotDto?>(null);
    }
}
