using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

public sealed class NotificationReliabilityTests
{
    [Fact]
    public async Task List_normalizes_legacy_tone_and_preserves_operations_task_entity()
    {
        await using var db = CreateDb();
        db.UserNotifications.Add(new UserNotification
        {
            Id = Guid.NewGuid(),
            UserId = "user-1",
            Title = "Legacy",
            Tone = "warning",
            Category = "workflow",
            EntityType = "operations-task",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var item = Assert.Single(await CreateService(db).ListForUserAsync("user-1"));

        Assert.Equal(NotificationContract.Tones.Warn, item.Tone);
        Assert.Equal(NotificationContract.EntityTypes.OperationsTask, item.EntityType);
    }

    [Fact]
    public async Task Mark_read_is_user_scoped_idempotent_and_persisted()
    {
        await using var db = CreateDb();
        var first = Seed("user-1");
        var second = Seed("user-1");
        var otherUser = Seed("user-2");
        db.UserNotifications.AddRange(first, second, otherUser);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        Assert.False(await service.MarkReadAsync("user-2", first.Id));
        Assert.True(await service.MarkReadAsync("user-1", first.Id));
        Assert.True(await service.MarkReadAsync("user-1", first.Id));

        db.ChangeTracker.Clear();
        Assert.NotNull((await db.UserNotifications.SingleAsync(n => n.Id == first.Id)).ReadAtUtc);
        Assert.Null((await db.UserNotifications.SingleAsync(n => n.Id == second.Id)).ReadAtUtc);
        Assert.Null((await db.UserNotifications.SingleAsync(n => n.Id == otherUser.Id)).ReadAtUtc);
    }

    [Fact]
    public async Task Non_owner_write_queues_platform_request_without_writing_inbox()
    {
        await using var db = CreateAppDb();
        await using var messaging = TestInspectorFeeServiceFactory.ShareMessaging(db);
        var service = new PlatformNotificationRequestService(
            messaging,
            new MessagingOutboxPublisher(
                messaging,
                NullLogger<MessagingOutboxPublisher>.Instance));

        var count = await service.CreateForUsersAsync(
            ["user-1", "user-2", "user-1"],
            new CreateUserNotificationRequest
            {
                Title = "Task reminder",
                Tone = "warning",
                EntityType = "operations-task",
                SourceEvent = "task-reminder:1",
            });

        Assert.Equal(2, count);
        Assert.Empty(await db.UserNotifications.ToListAsync());
        var outbox = Assert.Single(await db.OutboxMessages.ToListAsync());
        Assert.Equal(IntegrationEventTypes.NotificationUsersRequested, outbox.EventType);

        var envelope = JsonSerializer.Deserialize<
            IntegrationEventEnvelope<NotificationUsersRequestedPayload>>(outbox.PayloadJson);
        Assert.NotNull(envelope);
        Assert.Equal(["user-1", "user-2"], envelope.Payload.UserIds);
        Assert.Equal(NotificationContract.Tones.Warn, envelope.Payload.Tone);
        Assert.Equal(NotificationContract.EntityTypes.OperationsTask, envelope.Payload.EntityType);
    }

    [Fact]
    public async Task Platform_request_handler_persists_each_recipient_and_queues_realtime_events()
    {
        var name = $"notification-handler-{Guid.NewGuid():N}";
        var root = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
        await using var messaging = TestMessagingContexts.CreateMessaging(name, root: root);
        await using var app = TestMessagingContexts.CreateApp(name, root);
        var handler = new NotificationIntegrationEventHandler(
            TestInspectorFeeServiceFactory.CreateRecipients(app),
            CreateService(messaging),
            NullLogger<NotificationIntegrationEventHandler>.Instance);
        var payload = new NotificationUsersRequestedPayload(
            ["user-1", "user-2"],
            "Owned by Platform",
            null,
            null,
            "warning",
            "workflow",
            "operations-task",
            "task-1",
            null,
            "request:1");
        var json = JsonSerializer.Serialize(
            new IntegrationEventEnvelope<NotificationUsersRequestedPayload>(
                Guid.NewGuid(),
                IntegrationEventTypes.NotificationUsersRequested,
                DateTimeOffset.UtcNow,
                payload));

        await handler.HandleEnvelopeAsync(json);

        Assert.Equal(2, await messaging.UserNotifications.CountAsync());
        Assert.Equal(2, await messaging.OutboxMessages.CountAsync());
        Assert.All(
            await messaging.UserNotifications.ToListAsync(),
            row => Assert.Equal(NotificationContract.Tones.Warn, row.Tone));
        Assert.All(
            await messaging.OutboxMessages.ToListAsync(),
            row => Assert.Equal(IntegrationEventTypes.NotificationUserCreated, row.EventType));
    }

    [Fact]
    public async Task Realtime_handler_normalizes_legacy_payload_and_fans_out_once_per_connection()
    {
        var hub = new NotificationRealtimeHub();
        var (_, firstReader) = hub.Subscribe("user-1");
        var (_, secondReader) = hub.Subscribe("user-1");
        var handler = new NotificationRealtimePushHandler(
            hub,
            NullLogger<NotificationRealtimePushHandler>.Instance);
        var payload = new NotificationUserCreatedPayload(
            "user-1",
            Guid.NewGuid(),
            "Realtime",
            null,
            null,
            "warning",
            "workflow",
            "operations-task",
            "task-1",
            null,
            "legacy-event",
            DateTime.UtcNow,
            false);
        var json = JsonSerializer.Serialize(
            new IntegrationEventEnvelope<NotificationUserCreatedPayload>(
                Guid.NewGuid(),
                IntegrationEventTypes.NotificationUserCreated,
                DateTimeOffset.UtcNow,
                payload));

        await handler.HandleEnvelopeAsync(json);

        var first = await firstReader.ReadAsync();
        var second = await secondReader.ReadAsync();
        Assert.Equal(payload.Id, first.Id);
        Assert.Equal(payload.Id, second.Id);
        Assert.Equal(NotificationContract.Tones.Warn, first.Tone);
        Assert.Equal(NotificationContract.EntityTypes.OperationsTask, first.EntityType);
        Assert.False(firstReader.TryRead(out _));
        Assert.False(secondReader.TryRead(out _));
    }

    [Fact]
    public async Task CreateForUser_pushes_sse_immediately_without_waiting_for_outbox_fanout()
    {
        await using var messaging = CreateDb();
        var hub = new NotificationRealtimeHub();
        var (_, reader) = hub.Subscribe("user-1");
        var service = new NotificationService(
            messaging,
            new MessagingOutboxPublisher(
                messaging,
                NullLogger<MessagingOutboxPublisher>.Instance),
            hub);

        var created = await service.CreateForUserAsync(
            "user-1",
            new CreateUserNotificationRequest
            {
                Title = "Instant",
                Body = "after distribution",
                Category = "workflow",
                SourceEvent = "distribution-assigned:task-1",
            });

        var pushed = await reader.ReadAsync();
        Assert.Equal(created.Id, pushed.Id);
        Assert.Equal("Instant", pushed.Title);
        Assert.False(reader.TryRead(out _));
    }

    private static NotificationService CreateService(MessagingDbContext db) =>
        TestMessagingContexts.CreateNotificationService(db);

    private static UserNotification Seed(string userId) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = "Notification",
            CreatedAtUtc = DateTime.UtcNow,
        };

    private static MessagingDbContext CreateDb() =>
        TestMessagingContexts.CreateMessaging();

    private static ApplicationDbContext CreateAppDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"notification-reliability-app-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }
}
