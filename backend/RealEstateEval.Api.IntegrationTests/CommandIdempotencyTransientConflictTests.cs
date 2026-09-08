using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Shared.Web.Middleware;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// A 409 produced by an optimistic-concurrency race carries
/// <see cref="TransientConflict.HeaderName"/>; the idempotency middleware must let the client
/// replay that key instead of pinning the conflict to it. Domain 409s stay cached.
/// </summary>
public class CommandIdempotencyTransientConflictTests
{
    [Fact]
    public async Task Transient_conflict_is_not_cached_for_the_key()
    {
        var store = new RecordingStore();
        var middleware = new CommandIdempotencyMiddleware(
            async context =>
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                context.Response.Headers[TransientConflict.HeaderName] = TransientConflict.HeaderValue;
                await context.Response.WriteAsync("{\"status\":409}");
            },
            NullLogger<CommandIdempotencyMiddleware>.Instance);

        var context = MutatingRequest();
        await middleware.InvokeAsync(context, store);

        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        Assert.Empty(store.Saved);
    }

    [Fact]
    public async Task Domain_conflict_is_still_cached_for_the_key()
    {
        var store = new RecordingStore();
        var middleware = new CommandIdempotencyMiddleware(
            async context =>
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsync("{\"status\":409}");
            },
            NullLogger<CommandIdempotencyMiddleware>.Instance);

        var context = MutatingRequest();
        await middleware.InvokeAsync(context, store);

        var saved = Assert.Single(store.Saved);
        Assert.Equal(StatusCodes.Status409Conflict, saved.StatusCode);
    }

    private static DefaultHttpContext MutatingRequest()
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = "/api/things";
        context.Request.Headers[CommandIdempotencyMiddleware.HeaderName] = "test-key-0001";
        context.Response.Body = new MemoryStream();
        return context;
    }

    private sealed class RecordingStore : ICommandIdempotencyStore
    {
        public List<CommandIdempotencyCachedResponse> Saved { get; } = [];

        public Task<CommandIdempotencyCachedResponse?> TryGetAsync(
            string actorId,
            string httpMethod,
            string requestPath,
            string idempotencyKey,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<CommandIdempotencyCachedResponse?>(null);

        public Task SaveAsync(
            string actorId,
            string httpMethod,
            string requestPath,
            string idempotencyKey,
            CommandIdempotencyCachedResponse response,
            TimeSpan ttl,
            CancellationToken cancellationToken = default)
        {
            Saved.Add(response);
            return Task.CompletedTask;
        }
    }
}
