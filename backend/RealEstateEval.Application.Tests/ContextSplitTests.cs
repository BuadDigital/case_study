using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Attachments.Domain;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Valuation.Infrastructure.Services;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Acceptance tests for context extraction of architecture docs. They
/// check the two properties the split has to preserve while one database is shared: a row
/// written through its owner context is the same row every other context over the store sees,
/// and a business write still commits atomically with the event that announces it.
/// </summary>
public class ContextSplitTests
{
    [Fact]
    public async Task Attachment_written_through_its_owner_context_is_the_row_a_sibling_context_reads()
    {
        await using var contexts = TestDatabases.Create("phase1-attachments");
        var id = Guid.NewGuid();

        contexts.Attachments.FileAttachments.Add(new FileAttachment
        {
            Id = id,
            Scope = "property",
            ScopeKey = Guid.NewGuid().ToString(),
            FileName = "deed.pdf",
            ContentType = "application/pdf",
            StorageKey = $"attachments/{id:N}/deed.pdf",
            SizeBytes = 12,
            UploadedByUserId = "user-1",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await contexts.Attachments.SaveChangesAsync();

        // A sibling owner context derived from another member of the set proves the store is
        // one physical database shared by every context.
        await using var sibling = TestInspectorFeeServiceFactory.ShareAttachments(contexts.CaseStudy);
        var throughSibling = await sibling.FileAttachments
            .AsNoTracking()
            .SingleAsync(row => row.Id == id);
        Assert.Equal("deed.pdf", throughSibling.FileName);
    }

    [Fact]
    public async Task Platform_catalog_written_through_its_owner_context_is_visible_to_readers()
    {
        await using var contexts = TestDatabases.Create("phase1-platform");
        var id = Guid.NewGuid();

        contexts.Platform.Courts.Add(new Court
        {
            Id = id,
            Name = "محكمة التنفيذ بالرياض",
            Region = "الرياض",
            City = "الرياض",
            IsActive = true,
            CreatedBy = "system",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await contexts.Platform.SaveChangesAsync();

        await using var sibling = TestInspectorFeeServiceFactory.SharePlatform(contexts.CaseStudy);
        Assert.True(await sibling.Courts.AsNoTracking().AnyAsync(court => court.Id == id));
    }

 /// <summary>
 /// D5: the Valuation context maps <c>messaging.OutboxMessages</c> precisely so the request
 /// and its event are one <c>SaveChanges</c>. If the event were published through another
 /// context, a crash between the two saves would announce a request that does not exist.
 /// </summary>
    [Fact]
    public async Task Valuation_request_and_its_outbox_event_commit_through_one_context()
    {
        await using var contexts = TestDatabases.Create("phase1-valuation");
        var service = new ValuationRequestService(
            contexts.Valuation,
            new ValuationOutboxPublisher(
                contexts.Valuation,
                NullLogger<ValuationOutboxPublisher>.Instance),
            new FixedPoNumberLookup("PO-777"));

        var propertyId = Guid.NewGuid().ToString();
        var (created, error) = await service.CreateAsync(new SaveValuationRequestRequest
        {
            PropId = propertyId,
            Area = "جدة",
            Type = "فيلا",
            Appraiser = "مقيم",
            Status = ValuationRequestStatuses.Progress,
            Date = "2026-07-30",
        });

        Assert.Null(error);
        Assert.NotNull(created);

        var request = await contexts.Valuation.ValuationRequests.AsNoTracking().SingleAsync();
        var outbox = await contexts.Valuation.OutboxMessages.AsNoTracking().SingleAsync();

        Assert.Equal(propertyId, request.PropertyId);
        Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, outbox.EventType);
        Assert.Contains("PO-777", outbox.PayloadJson);

 // Same physical tables, so the central dispatcher (Messaging context) still sees the row.
        Assert.Single(contexts.Messaging.OutboxMessages);
    }

 /// <summary>
 /// The Valuation context maps no Case Study table, which is what forces the PO number to
 /// arrive through <c>IPropertyPoNumberLookup</c> rather than a join.
 /// </summary>
    [Fact]
    public async Task Valuation_context_cannot_reach_case_study_tables()
    {
        await using var contexts = TestDatabases.Create("phase1-valuation-isolation");

 // An unmapped schema surfaces as "" and fails the comparison rather than disappearing.
        var schemas = contexts.Valuation.Model
            .GetEntityTypes()
            .Select(entity => entity.GetSchema() ?? "")
            .Distinct()
            .Order(StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(new[] { "messaging", "valuation" }, schemas);
    }

    [Fact]
    public async Task Po_number_lookup_returns_the_work_orders_number_and_empty_for_unknown_properties()
    {
        await using var contexts = TestDatabases.Create("phase1-po-lookup");
        var workOrderId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        contexts.CaseStudy.WorkOrders.Add(new WorkOrder
        {
            Id = workOrderId,
            PoNumber = "PO-4242",
            ExpectedPropertyCount = 1,
            CreatedAtUtc = now,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now),
            AssignmentType = AssignmentType.Execution,
        });
        contexts.CaseStudy.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = propertyId,
            WorkOrderId = workOrderId,
            City = "جدة",
            PropertyType = "فيلا",
            Classification = "سكني",
            IdentifierType = PropertyIdentifierType.RealEstateRegistration,
            DeedNumber = "1234567890",
        });
        await contexts.CaseStudy.SaveChangesAsync();

        var lookup = new CaseStudyPropertyPoNumberLookup(contexts.CaseStudy);

        Assert.Equal("PO-4242", await lookup.ResolveForPropertyAsync(propertyId.ToString()));
        Assert.Equal("", await lookup.ResolveForPropertyAsync(Guid.NewGuid().ToString()));
        Assert.Equal("", await lookup.ResolveForPropertyAsync("not-a-guid"));
    }

    private sealed class FixedPoNumberLookup(string poNumber) : Abstractions.IPropertyPoNumberLookup
    {
        public Task<string> ResolveForPropertyAsync(
            string propertyId,
            CancellationToken cancellationToken = default) => Task.FromResult(poNumber);
    }
}
