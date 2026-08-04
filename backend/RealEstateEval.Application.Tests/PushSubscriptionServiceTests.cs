using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using Microsoft.Extensions.Options;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class PushSubscriptionServiceTests
{
    private static MessagingDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<MessagingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new MessagingDbContext(options);
    }

    private static PushSubscriptionService CreateService(MessagingDbContext db) =>
        new(
            db,
            Options.Create(new WebPushOptions
            {
                Enabled = true,
                PublicKey = "public",
                PrivateKey = "private",
                Subject = "mailto:test@example.com",
            }));

    [Fact]
    public async Task Upsert_DoesNotDuplicateEndpoint()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);
        var request = new RegisterPushSubscriptionRequest(
            "https://push.example/endpoint-1",
            "p256",
            "auth",
            "UA",
            "phone");

        await svc.UpsertAsync("user-a", request);
        await svc.UpsertAsync("user-a", request);

        Assert.Equal(1, await db.PushSubscriptions.CountAsync());
    }

    [Fact]
    public async Task Upsert_RebindsEndpointToNewUser()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);
        var request = new RegisterPushSubscriptionRequest(
            "https://push.example/endpoint-2",
            "p256",
            "auth",
            null,
            null);

        await svc.UpsertAsync("user-a", request);
        await svc.UpsertAsync("user-b", request);

        var row = await db.PushSubscriptions.SingleAsync();
        Assert.Equal("user-b", row.UserId);
        Assert.Null(row.DisabledAtUtc);
    }

    [Fact]
    public async Task Delete_IsUserScoped()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);
        var request = new RegisterPushSubscriptionRequest(
            "https://push.example/endpoint-3",
            "p256",
            "auth",
            null,
            null);
        await svc.UpsertAsync("user-a", request);

        Assert.False(await svc.DeleteAsync("user-b", request.Endpoint));
        Assert.True(await svc.DeleteAsync("user-a", request.Endpoint));
        Assert.Equal(0, await db.PushSubscriptions.CountAsync());
    }
}
