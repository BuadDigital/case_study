using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

public sealed class NotificationBatchingTests
{
    [Fact]
    public async Task CreateForUsersAsync_uses_one_save_for_all_recipients_and_outbox_rows()
    {
        var saveCounter = new SaveCounterInterceptor();
        await using var db = CreateMessagingDb(saveCounter);
        var service = TestMessagingContexts.CreateNotificationService(db);
        var userIds = Enumerable.Range(1, 25).Select(i => $"user-{i}").ToList();

        var count = await service.CreateForUsersAsync(
            [.. userIds, userIds[0]],
            CreateRequest("batch-event"));

        Assert.Equal(userIds.Count, count);
        Assert.Equal(1, saveCounter.SaveChangesCalls);
        Assert.Equal(userIds.Count, await db.UserNotifications.CountAsync());
        Assert.Equal(userIds.Count, await db.OutboxMessages.CountAsync());
    }

    [Fact]
    public async Task CreateForUsersAsync_deduplicates_every_user_in_one_save()
    {
        var saveCounter = new SaveCounterInterceptor();
        await using var db = CreateMessagingDb(saveCounter);
        var service = TestMessagingContexts.CreateNotificationService(db);
        string[] userIds = ["user-1", "user-2", "user-3"];

        await service.CreateForUsersAsync(userIds, CreateRequest("same-event"));
        var originalIds = await db.UserNotifications
            .OrderBy(n => n.UserId)
            .Select(n => n.Id)
            .ToListAsync();
        saveCounter.Reset();

        await service.CreateForUsersAsync(
            userIds,
            CreateRequest("same-event", title: "Updated title"));

        Assert.Equal(1, saveCounter.SaveChangesCalls);
        Assert.Equal(userIds.Length, await db.UserNotifications.CountAsync());
        Assert.Equal(
            originalIds,
            await db.UserNotifications.OrderBy(n => n.UserId).Select(n => n.Id).ToListAsync());
        Assert.All(await db.UserNotifications.ToListAsync(), row => Assert.Equal("Updated title", row.Title));
        Assert.Equal(userIds.Length * 2, await db.OutboxMessages.CountAsync());
    }

    [Fact]
    public async Task ResolveUserIdsWithPrototypeRoleAsync_resolves_many_profiles_as_a_batch()
    {
        await using var db = CreateDb();
        var expected = Enumerable.Range(1, 30).Select(i => $"reviewer-{i}").ToList();
        db.UserProfiles.AddRange(expected.Select(userId => new UserProfile
        {
            UserId = userId,
            RoleId = "government-reviewer",
            JobTitle = "مراجع حكومي",
            Status = UserStatus.Active,
        }));
        db.UserProfiles.Add(new UserProfile
        {
            UserId = "inactive-reviewer",
            RoleId = "government-reviewer",
            JobTitle = "مراجع حكومي",
            Status = UserStatus.Disabled,
        });
        await db.SaveChangesAsync();

        var result = await TestInspectorFeeServiceFactory.CreateRecipients(db)
            .ResolveUserIdsWithPrototypeRoleAsync("government-reviewer");

        Assert.Equal(expected.Order(), result.Order());
    }

    [Fact]
    public async Task ResolveUserIdsForDistributionAssigneesAsync_resolves_all_ids_together()
    {
        await using var db = CreateDb();
        db.UserProfiles.AddRange(Enumerable.Range(1, 20).Select(i => new UserProfile
        {
            UserId = $"user-{i}",
            DistributionAssigneeId = $"assignee-{i}",
            Status = UserStatus.Active,
        }));
        await db.SaveChangesAsync();

        var result = await TestInspectorFeeServiceFactory.CreateRecipients(db)
            .ResolveUserIdsForDistributionAssigneesAsync(
                Enumerable.Range(1, 20).Select(i => $"assignee-{i}").ToList());

        Assert.Equal(20, result.Count);
        Assert.Equal("user-17", result["assignee-17"]);
    }

    private static CreateUserNotificationRequest CreateRequest(
        string sourceEvent,
        string title = "Batch notification") =>
        new()
        {
            Title = title,
            Body = "Body",
            SourceEvent = sourceEvent,
            Category = "workflow",
        };

    private static MessagingDbContext CreateMessagingDb(SaveCounterInterceptor? saveCounter = null) =>
        TestMessagingContexts.CreateMessaging(interceptor: saveCounter);

    private static IdentityDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseInMemoryDatabase($"notifications-identity-{Guid.NewGuid():N}")
            .Options;
        return new IdentityDbContext(options);
    }

    private sealed class SaveCounterInterceptor : SaveChangesInterceptor
    {
        public int SaveChangesCalls { get; private set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            SaveChangesCalls++;
            return ValueTask.FromResult(result);
        }

        public void Reset() => SaveChangesCalls = 0;
    }
}
