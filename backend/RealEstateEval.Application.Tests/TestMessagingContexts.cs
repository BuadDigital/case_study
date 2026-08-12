using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>In-memory Messaging (+ optional App) fixtures for Platform notification tests.</summary>
internal static class TestMessagingContexts
{
    public static MessagingDbContext CreateMessaging(
        string? name = null,
        SaveChangesInterceptor? interceptor = null,
        InMemoryDatabaseRoot? root = null)
    {
        name ??= $"messaging-{Guid.NewGuid():N}";
        root ??= new InMemoryDatabaseRoot();
        var builder = new DbContextOptionsBuilder<MessagingDbContext>()
            .UseInMemoryDatabase(name, root)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
        if (interceptor is not null)
            builder.AddInterceptors(interceptor);
        return new MessagingDbContext(builder.Options);
    }

    public static ApplicationDbContext CreateApp(
        string name,
        InMemoryDatabaseRoot root)
    {
        return new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(name, root)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);
    }

    public static NotificationService CreateNotificationService(
        MessagingDbContext messaging) =>
        new(
            messaging,
            new MessagingOutboxPublisher(
                messaging,
                NullLogger<MessagingOutboxPublisher>.Instance),
            new NotificationRealtimeHub());
}
