using System.Security.Claims;
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
        Assert.Equal(1, store.ReleaseCalls);
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

    [Fact]
    public async Task Concurrent_same_key_is_rejected_before_the_handler_runs()
    {
        var store = new RecordingStore
        {
            AcquireResult = new CommandIdempotencyAcquireResult(
                CommandIdempotencyAcquireStatus.InProgress),
        };
        var handlerRuns = 0;
        var middleware = new CommandIdempotencyMiddleware(
            _ =>
            {
                handlerRuns++;
                return Task.CompletedTask;
            },
            NullLogger<CommandIdempotencyMiddleware>.Instance);

        var context = MutatingRequest();
        await middleware.InvokeAsync(context, store);

        Assert.Equal(0, handlerRuns);
        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        Assert.Equal("true", context.Response.Headers[CommandIdempotencyMiddleware.InProgressHeaderName]);
    }

    [Fact]
    public async Task Anonymous_auth_request_bypasses_idempotency_replay()
    {
        var store = new RecordingStore
        {
            AcquireResult = new CommandIdempotencyAcquireResult(
                CommandIdempotencyAcquireStatus.Replay,
                Response: new CommandIdempotencyCachedResponse(
                    StatusCodes.Status200OK,
                    "application/json",
                    """{"accessToken":"other-caller"}"""u8.ToArray())),
        };
        var handlerRuns = 0;
        var middleware = new CommandIdempotencyMiddleware(
            async context =>
            {
                handlerRuns++;
                await context.Response.WriteAsync("""{"accessToken":"fresh"}""");
            },
            NullLogger<CommandIdempotencyMiddleware>.Instance);

        var context = MutatingRequest(authenticated: false);
        context.Request.Path = "/api/auth/login";
        await middleware.InvokeAsync(context, store);

        Assert.Equal(1, handlerRuns);
        Assert.Equal(0, store.AcquireCalls);
        Assert.Contains("fresh", await ResponseBodyAsync(context), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Completion_failure_does_not_release_the_reservation()
    {
        var store = new RecordingStore
        {
            CompletionError = new InvalidOperationException("database unavailable"),
        };
        var middleware = new CommandIdempotencyMiddleware(
            async context =>
            {
                context.Response.StatusCode = StatusCodes.Status201Created;
                await context.Response.WriteAsync("""{"created":true}""");
            },
            NullLogger<CommandIdempotencyMiddleware>.Instance);

        var context = MutatingRequest();
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => middleware.InvokeAsync(context, store));

        Assert.Equal(0, store.ReleaseCalls);
    }

    [Fact]
    public async Task Server_error_does_not_release_the_reservation()
    {
        var store = new RecordingStore();
        var middleware = new CommandIdempotencyMiddleware(
            context =>
            {
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                return Task.CompletedTask;
            },
            NullLogger<CommandIdempotencyMiddleware>.Instance);

        await middleware.InvokeAsync(MutatingRequest(), store);

        Assert.Equal(0, store.ReleaseCalls);
        Assert.Empty(store.Saved);
    }

    [Fact]
    public async Task Replay_restores_the_location_header()
    {
        var store = new RecordingStore
        {
            AcquireResult = new CommandIdempotencyAcquireResult(
                CommandIdempotencyAcquireStatus.Replay,
                Response: new CommandIdempotencyCachedResponse(
                    StatusCodes.Status201Created,
                    "application/json",
                    """{"id":"attachment-1"}"""u8.ToArray(),
                    "/api/attachments/attachment-1")),
        };
        var handlerRuns = 0;
        var middleware = new CommandIdempotencyMiddleware(
            _ =>
            {
                handlerRuns++;
                return Task.CompletedTask;
            },
            NullLogger<CommandIdempotencyMiddleware>.Instance);

        var context = MutatingRequest();
        await middleware.InvokeAsync(context, store);

        Assert.Equal(0, handlerRuns);
        Assert.Equal(StatusCodes.Status201Created, context.Response.StatusCode);
        Assert.Equal(
            "/api/attachments/attachment-1",
            context.Response.Headers.Location.ToString());
    }

    [Fact]
    public async Task Successful_create_caches_the_location_header()
    {
        var store = new RecordingStore();
        var middleware = new CommandIdempotencyMiddleware(
            async context =>
            {
                context.Response.StatusCode = StatusCodes.Status201Created;
                context.Response.Headers.Location = "/api/attachments/attachment-2";
                await context.Response.WriteAsync("""{"id":"attachment-2"}""");
            },
            NullLogger<CommandIdempotencyMiddleware>.Instance);

        await middleware.InvokeAsync(MutatingRequest(), store);

        Assert.Equal(
            "/api/attachments/attachment-2",
            Assert.Single(store.Saved).Location);
    }

    private static async Task<string> ResponseBodyAsync(DefaultHttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        return await reader.ReadToEndAsync();
    }

    private static DefaultHttpContext MutatingRequest(bool authenticated = true)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = "/api/things";
        context.Request.Headers[CommandIdempotencyMiddleware.HeaderName] = "test-key-0001";
        context.Response.Body = new MemoryStream();
        if (authenticated)
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "actor-1")],
                "test"));
        }

        return context;
    }

    private sealed class RecordingStore : ICommandIdempotencyStore
    {
        public List<CommandIdempotencyCachedResponse> Saved { get; } = [];
        public int AcquireCalls { get; private set; }
        public int ReleaseCalls { get; private set; }
        public Exception? CompletionError { get; set; }
        public CommandIdempotencyAcquireResult AcquireResult { get; set; } =
            new(CommandIdempotencyAcquireStatus.Acquired, "execution-1");

        public Task<CommandIdempotencyAcquireResult> TryAcquireAsync(
            CommandIdempotencyRequestKey key,
            TimeSpan processingLease,
            CancellationToken cancellationToken = default)
        {
            AcquireCalls++;
            return Task.FromResult(AcquireResult);
        }

        public Task<bool> CompleteAsync(
            CommandIdempotencyRequestKey key,
            string executionId,
            CommandIdempotencyCachedResponse response,
            TimeSpan ttl,
            CancellationToken cancellationToken = default)
        {
            if (CompletionError is not null)
                throw CompletionError;

            Saved.Add(response);
            return Task.FromResult(true);
        }

        public Task ReleaseAsync(
            CommandIdempotencyRequestKey key,
            string executionId,
            CancellationToken cancellationToken = default)
        {
            ReleaseCalls++;
            return Task.CompletedTask;
        }
    }
}
