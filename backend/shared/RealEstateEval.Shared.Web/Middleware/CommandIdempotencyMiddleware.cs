using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Shared.Web.Middleware;

/// <summary>
/// Honors optional <c>Idempotency-Key</c> on mutating requests.
/// Same authenticated actor + path + key within the TTL returns the cached response body/status
/// instead of re-running the action. Domain uniqueness remains the primary guard;
/// this closes multi-tab / retry gaps for clients that send the header (ADR 0008).
/// </summary>
public sealed class CommandIdempotencyMiddleware(
    RequestDelegate next,
    ILogger<CommandIdempotencyMiddleware> logger)
{
    public const string HeaderName = "Idempotency-Key";
    public const string InProgressHeaderName = "Idempotency-Key-In-Progress";
    public static readonly TimeSpan DefaultTtl = TimeSpan.FromHours(24);
    public static readonly TimeSpan ProcessingLease = TimeSpan.FromMinutes(15);
    private static readonly HashSet<string> MutatingMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Post,
        HttpMethods.Put,
        HttpMethods.Patch,
        HttpMethods.Delete,
    };

    public async Task InvokeAsync(HttpContext context, ICommandIdempotencyStore store)
    {
        if (!MutatingMethods.Contains(context.Request.Method)
            || !context.Request.Headers.TryGetValue(HeaderName, out var rawKey))
        {
            await next(context);
            return;
        }

        // An unauthenticated request has no caller identity with which to scope a replay.
        // Caching login/refresh responses under a shared "anonymous" actor can disclose one
        // caller's tokens to another caller that supplies the same key.
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }

        var key = rawKey.ToString().Trim();
        if (key.Length is < 8 or > 128)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new
            {
                title = "Invalid Idempotency-Key",
                detail = "Idempotency-Key must be 8–128 characters.",
            });
            return;
        }

        var actor = ResolveActor(context.User);
        if (actor is null)
        {
            logger.LogWarning(
                "Skipping Idempotency-Key because the authenticated principal has no stable actor id");
            await next(context);
            return;
        }

        var method = context.Request.Method;
        var path = context.Request.Path.Value ?? "";
        var requestKey = new CommandIdempotencyRequestKey(actor, method, path, key);

        var acquisition = await store.TryAcquireAsync(
            requestKey,
            ProcessingLease,
            context.RequestAborted);
        if (acquisition.Status == CommandIdempotencyAcquireStatus.Replay)
        {
            var cached = acquisition.Response
                ?? throw new InvalidOperationException("Replay result is missing its cached response.");
            logger.LogInformation(
                "Replaying Idempotency-Key response for {Method} {Path}",
                method,
                path);
            context.Response.StatusCode = cached.StatusCode;
            if (!string.IsNullOrEmpty(cached.ContentType))
                context.Response.ContentType = cached.ContentType;
            if (!string.IsNullOrEmpty(cached.Location))
                context.Response.Headers.Location = cached.Location;
            context.Response.Headers[HeaderName] = key;
            await context.Response.Body.WriteAsync(cached.Body, context.RequestAborted);
            return;
        }

        if (acquisition.Status == CommandIdempotencyAcquireStatus.InProgress)
        {
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            context.Response.Headers[HeaderName] = key;
            context.Response.Headers[InProgressHeaderName] = "true";
            context.Response.Headers.RetryAfter = "1";
            await context.Response.WriteAsJsonAsync(
                new
                {
                    title = "الطلب قيد التنفيذ",
                    detail = "طلب يحمل مفتاح التكرار نفسه ما زال قيد التنفيذ — أعد المحاولة بعد لحظات.",
                },
                context.RequestAborted);
            return;
        }

        var executionId = acquisition.ExecutionId
            ?? throw new InvalidOperationException("Acquired result is missing its execution id.");
        var originalBody = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await next(context);

            buffer.Position = 0;
            var bytes = buffer.ToArray();

            // Cache successful and domain-conflict outcomes so retries are stable. A transient
            // (row-version) conflict is the one 409 a retry is meant to get past, so it is
            // never pinned to the key.
            var transientConflict = context.Response.StatusCode == StatusCodes.Status409Conflict
                && context.Response.Headers.ContainsKey(TransientConflict.HeaderName);
            if (!transientConflict
                && (context.Response.StatusCode is >= 200 and < 300
                    or StatusCodes.Status409Conflict
                    or StatusCodes.Status400BadRequest))
            {
                var location = context.Response.Headers.Location.ToString();
                var completed = await store.CompleteAsync(
                    requestKey,
                    executionId,
                    new CommandIdempotencyCachedResponse(
                        context.Response.StatusCode,
                        context.Response.ContentType,
                        bytes,
                        string.IsNullOrWhiteSpace(location) ? null : location),
                    DefaultTtl,
                    CancellationToken.None);
                if (!completed)
                {
                    logger.LogWarning(
                        "Lost Idempotency-Key lease before completing {Method} {Path}",
                        method,
                        path);
                }
            }
            else if (context.Response.StatusCode < StatusCodes.Status500InternalServerError)
            {
                await store.ReleaseAsync(requestKey, executionId, CancellationToken.None);
            }
            else
            {
                // A 5xx can be emitted after the command committed. Keep the lease rather
                // than allowing an immediate retry to repeat an unknown side effect.
                logger.LogWarning(
                    "Retaining Idempotency-Key reservation after {StatusCode} from {Method} {Path}",
                    context.Response.StatusCode,
                    method,
                    path);
            }

            buffer.Position = 0;
            context.Response.Body = originalBody;
            context.Response.Headers[HeaderName] = key;
            await buffer.CopyToAsync(originalBody, context.RequestAborted);
        }
        catch (Exception ex)
        {
            // The handler may have committed before throwing, or completion persistence may
            // be the failing operation. Releasing here would permit an immediate duplicate.
            logger.LogWarning(
                ex,
                "Retaining Idempotency-Key reservation after indeterminate execution of {Method} {Path}",
                method,
                path);
            throw;
        }
        finally
        {
            context.Response.Body = originalBody;
        }
    }

    private static string? ResolveActor(ClaimsPrincipal user)
    {
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? user.Identity?.Name;
        return string.IsNullOrWhiteSpace(id) ? null : id.Trim();
    }
}

public static class CommandIdempotencyExtensions
{
    /// <summary>
    /// Registers a memory-backed fallback. Mutating hosts replace it with a durable
    /// Messaging- or owner-database store.
    /// </summary>
    public static IServiceCollection AddCommandIdempotency(this IServiceCollection services)
    {
        services.AddMemoryCache();
        services.TryAddSingleton<ICommandIdempotencyStore, MemoryCommandIdempotencyStore>();
        return services;
    }

    public static IApplicationBuilder UseCommandIdempotency(this IApplicationBuilder app) =>
        app.UseMiddleware<CommandIdempotencyMiddleware>();
}
