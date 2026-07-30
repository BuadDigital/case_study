using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The dedupe probe has to agree with the unique index that now enforces it, otherwise a
/// resend the probe treats as new is rejected by the database instead.
/// </summary>
public class NotificationDedupeRuleTests
{
    private const string SourceEvent = "ops-task-assigned:7";

    [Fact]
    public async Task An_unread_notification_is_refreshed_however_old_it_is()
    {
        await using var db = CreateDb();
        db.UserNotifications.Add(Existing(readAt: null, ageMinutes: 30));
        await db.SaveChangesAsync();

        await CreateService(db).CreateForUsersAsync(["user-1"], Request("أُسندت إليك المهمة"));

        var row = await db.UserNotifications.SingleAsync();
        Assert.Equal("أُسندت إليك المهمة", row.Title);
        Assert.Null(row.ReadAtUtc);
    }

    [Fact]
    public async Task A_read_notification_does_not_suppress_the_next_one()
    {
        await using var db = CreateDb();
        db.UserNotifications.Add(Existing(readAt: DateTime.UtcNow.AddMinutes(-5), ageMinutes: 30));
        await db.SaveChangesAsync();

        await CreateService(db).CreateForUsersAsync(["user-1"], Request("أُسندت إليك المهمة"));

        Assert.Equal(2, await db.UserNotifications.CountAsync());
        Assert.Equal(
            1,
            await db.UserNotifications.CountAsync(n => n.ReadAtUtc == null));
    }

    [Fact]
    public async Task Notifications_without_a_source_event_are_never_deduplicated()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        await service.CreateForUsersAsync(["user-1"], Request("تنبيه", sourceEvent: null));
        await service.CreateForUsersAsync(["user-1"], Request("تنبيه", sourceEvent: null));

        Assert.Equal(2, await db.UserNotifications.CountAsync());
    }

    private static UserNotification Existing(DateTime? readAt, int ageMinutes) => new()
    {
        Id = Guid.NewGuid(),
        UserId = "user-1",
        Title = "نسخة سابقة",
        SourceEvent = SourceEvent,
        CreatedAtUtc = DateTime.UtcNow.AddMinutes(-ageMinutes),
        ReadAtUtc = readAt,
    };

    private static CreateUserNotificationRequest Request(
        string title,
        string? sourceEvent = SourceEvent) => new()
    {
        Title = title,
        Body = "التفاصيل",
        Category = "workflow",
        SourceEvent = sourceEvent,
    };

    private static NotificationService CreateService(ApplicationDbContext db) =>
        new(
            db,
            new OutboxIntegrationEventPublisher(
                db,
                NullLogger<OutboxIntegrationEventPublisher>.Instance));

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"notification-dedupe-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }
}
