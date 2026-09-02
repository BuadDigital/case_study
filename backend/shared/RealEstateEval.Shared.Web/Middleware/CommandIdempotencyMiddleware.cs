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
/// Same actor + path + key within the TTL returns the cached response body/status
/// instead of re-running the action. Domain uniqueness remains the primary guard;
/// this closes multi-tab / retry gaps for clients that send the header (ADR 0008).
/// </summary>
public sealed class CommandIdempotencyMiddleware(
    RequestDelegate next,
    ILogger<CommandIdempotencyMiddleware> logger)
{
    public const string HeaderName = "Idempotency-Key";
    public static readonly TimeSpan DefaultTtl = TimeSpan.FromHours(24);
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
        var method = context.Request.Method;
        var path = context.Request.Path.Value ?? "";

        var cached = await store.TryGetAsync(actor, method, path, key, context.RequestAborted);
        if (cached is not null)
        {
            logger.LogInformation(
                "Replaying Idempotency-Key response for {Method} {Path}",
                method,
                path);
            context.Response.StatusCode = cached.StatusCode;
            if (!string.IsNullOrEmpty(cached.ContentType))
                context.Response.ContentType = cached.ContentType;
            context.Response.Headers[HeaderName] = key;
            await context.Response.Body.WriteAsync(cached.Body, context.RequestAborted);
            return;
        }

        var originalBody = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await next(context);

            buffer.Position = 0;
            var bytes = buffer.ToArray();

            // Cache successful and domain-conflict outcomes so retries are stable.
            if (context.Response.StatusCode is >= 200 and < 300
                or StatusCodes.Status409Conflict
                or StatusCodes.Status400BadRequest)
            {
                await store.SaveAsync(
                    actor,
                    method,
                    path,
                    key,
                    new CommandIdempotencyCachedResponse(
                        context.Response.StatusCode,
                        context.Response.ContentType,
                        bytes),
                    DefaultTtl,
                    context.RequestAborted);
            }

            buffer.Position = 0;
            context.Response.Body = originalBody;
            context.Response.Headers[HeaderName] = key;
            await buffer.CopyToAsync(originalBody, context.RequestAborted);
        }
        finally
        {
            context.Response.Body = originalBody;
        }
    }

    private static string ResolveActor(ClaimsPrincipal user)
    {
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? user.Identity?.Name;
        return string.IsNullOrWhiteSpace(id) ? "anonymous" : id.Trim();
    }
}

public static class CommandIdempotencyExtensions
{
    /// <summary>
    /// Registers memory-backed store as the default. Hosts that call
    /// <c>AddMessagingPersistence</c> replace it with the durable EF store.
    /// </summary>
    public static IServiceCollection AddCommandIdempotency(this IServiceCollection services)
    {
        services.AddMemoryCache();
        services.TryAddScoped<ICommandIdempotencyStore, MemoryCommandIdempotencyStore>();
        return services;
    }

    public static IApplicationBuilder UseCommandIdempotency(this IApplicationBuilder app) =>
        app.UseMiddleware<CommandIdempotencyMiddleware>();
}
