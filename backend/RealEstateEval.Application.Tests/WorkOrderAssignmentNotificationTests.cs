using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

public sealed class WorkOrderAssignmentNotificationTests
{
    [Fact]
    public async Task ResolveUserIdForEmail_matches_normalized_identity_email()
    {
        await using var db = CreateDb();
        SeedUser(db, "user-feras", "feras@ejadah.dev");
        await db.SaveChangesAsync();

        var resolver = new NotificationRecipientResolver(db);

        Assert.Equal(
            "user-feras",
            await resolver.ResolveUserIdForEmailAsync("Feras@EjadaH.dev"));
        Assert.Null(await resolver.ResolveUserIdForEmailAsync("unknown@ejadah.dev"));
        Assert.Null(await resolver.ResolveUserIdForEmailAsync("  "));
    }

    [Fact]
    public async Task CreateAsync_queues_assignment_notification_for_mapped_specialist()
    {
        await using var db = CreateDb();
        SeedUser(db, "user-feras", "feras@ejadah.dev");
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var (result, errors) = await service.CreateAsync(
            ValidCreate("PO-ASSIGN-1", "feras@ejadah.dev"),
            CancellationToken.None);

        Assert.Null(errors);
        Assert.NotNull(result);
        var payload = await AssertSingleNotificationRequest(db);
        Assert.Equal(["user-feras"], payload.UserIds);
        Assert.Equal("معاملة جديدة بانتظارك", payload.Title);
        Assert.Equal(NotificationContract.Tones.Info, payload.Tone);
        Assert.Equal(NotificationContract.Categories.Workflow, payload.Category);
        Assert.Equal(NotificationContract.EntityTypes.WorkOrder, payload.EntityType);
        Assert.Equal("PO-ASSIGN-1", payload.EntityId);
        Assert.Equal("/po/PO-ASSIGN-1/property", payload.Href);
        Assert.Equal("work-order-assigned:PO-ASSIGN-1:user-feras", payload.SourceEvent);
    }

    [Fact]
    public async Task CreateAsync_skips_notification_when_email_unmapped()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        var (result, errors) = await service.CreateAsync(
            ValidCreate("PO-UNMAPPED", "ghost@ejadah.dev"),
            CancellationToken.None);

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.Empty(await db.OutboxMessages.ToListAsync());
    }

    [Fact]
    public async Task UpdateHeaderAsync_notifies_only_when_specialist_email_changes()
    {
        await using var db = CreateDb();
        SeedUser(db, "user-a", "a@ejadah.dev");
        SeedUser(db, "user-b", "b@ejadah.dev");
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var (created, createErrors) = await service.CreateAsync(
            ValidCreate("PO-REASSIGN", "a@ejadah.dev"),
            CancellationToken.None);
        Assert.Null(createErrors);
        Assert.NotNull(created);
        Assert.Single(await db.OutboxMessages.ToListAsync());

        var sameEmail = await service.UpdateHeaderAsync(
            "PO-REASSIGN",
            ValidUpdate("A@EjadaH.dev"),
            CancellationToken.None);
        Assert.Null(sameEmail.Errors);
        Assert.Single(await db.OutboxMessages.ToListAsync());

        var changed = await service.UpdateHeaderAsync(
            "PO-REASSIGN",
            ValidUpdate("b@ejadah.dev"),
            CancellationToken.None);
        Assert.Null(changed.Errors);

        var rows = await db.OutboxMessages.OrderBy(r => r.CreatedAtUtc).ToListAsync();
        Assert.Equal(2, rows.Count);
        var payload = Deserialize(rows[^1]);
        Assert.Equal(["user-b"], payload.UserIds);
        Assert.Equal("work-order-assigned:PO-REASSIGN:user-b", payload.SourceEvent);
        Assert.Equal("/po/PO-REASSIGN/property", payload.Href);
    }

    [Fact]
    public async Task UpdateHeaderAsync_preserves_the_deadline_stamped_at_receipt()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, createErrors) = await service.CreateAsync(
            ValidCreate("PO-FIXED-DUE", "owner@ejadah.dev"),
            CancellationToken.None);
        Assert.Null(createErrors);
        Assert.NotNull(created);
        var originalDueDate = await db.WorkOrders
            .Where(w => w.PoNumber == "PO-FIXED-DUE")
            .Select(w => w.DueDateAt)
            .SingleAsync();

        var request = ValidUpdate("owner@ejadah.dev");
        request.AssignmentType = AssignmentTypeLabels.Execution;
        request.PromulgationDate = "2026-07-20";
        request.ReceivedFromEnfathTime = "16:30";
        var (_, errors) = await service.UpdateHeaderAsync(
            "PO-FIXED-DUE",
            request,
            CancellationToken.None);

        Assert.Null(errors);
        var stored = await db.WorkOrders.SingleAsync(w => w.PoNumber == "PO-FIXED-DUE");
        Assert.Equal(originalDueDate, stored.DueDateAt);
        // The editable facts still change; only the accepted SLA snapshot is immutable.
        Assert.Equal(new DateOnly(2026, 7, 20), stored.ReceivedFromEnfathAt);
        Assert.Equal(AssignmentType.Execution, stored.AssignmentType);
    }

    private static CreateWorkOrderRequest ValidCreate(string po, string email) => new()
    {
        PoNumber = po,
        AssignmentType = AssignmentTypeLabels.Estates,
        PromulgationDate = "2026-06-07",
        AssignmentSpecialist = "Specialist",
        AssignmentSpecialistEmail = email,
        ExpectedPropertyCount = 1,
    };

    private static UpdateWorkOrderHeaderRequest ValidUpdate(string email) => new()
    {
        AssignmentType = AssignmentTypeLabels.Estates,
        PromulgationDate = "2026-06-07",
        AssignmentSpecialist = "Specialist",
        AssignmentSpecialistEmail = email,
        ExpectedPropertyCount = 1,
    };

    private static void SeedUser(ApplicationDbContext db, string userId, string email)
    {
        db.Users.Add(new ApplicationUser
        {
            Id = userId,
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            DisplayName = userId,
        });
    }

    private static async Task<NotificationUsersRequestedPayload> AssertSingleNotificationRequest(
        ApplicationDbContext db)
    {
        var outbox = Assert.Single(await db.OutboxMessages.ToListAsync());
        Assert.Equal(IntegrationEventTypes.NotificationUsersRequested, outbox.EventType);
        return Deserialize(outbox);
    }

    private static NotificationUsersRequestedPayload Deserialize(OutboxMessage outbox)
    {
        var envelope = JsonSerializer.Deserialize<
            IntegrationEventEnvelope<NotificationUsersRequestedPayload>>(outbox.PayloadJson);
        Assert.NotNull(envelope);
        return envelope.Payload;
    }

    private static WorkOrderService CreateService(ApplicationDbContext db)
    {
        var timeline = new PropertyTimelineService(db);
        var notifications = new PlatformNotificationRequestService(
            db,
            new OutboxIntegrationEventPublisher(
                db,
                NullLogger<OutboxIntegrationEventPublisher>.Instance));
        var recipients = new NotificationRecipientResolver(db);
        var failures = new FailureService(
            db,
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            timeline,
            notifications,
            recipients);
        return new WorkOrderService(db, timeline, failures, notifications, recipients);
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"wo-assign-notify-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }
}
