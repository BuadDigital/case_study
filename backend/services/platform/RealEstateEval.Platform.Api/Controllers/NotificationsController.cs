using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly INotificationService _notifications;
    private readonly NotificationRealtimeHub _realtime;

    public NotificationsController(
        INotificationService notifications,
        NotificationRealtimeHub realtime)
    {
        _notifications = notifications;
        _realtime = realtime;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserNotificationDto>>> List(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        return Ok(await _notifications.ListForUserAsync(userId, ct));
    }

    [HttpGet("stream")]
    public async Task Stream(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        Response.Headers.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Connection = "keep-alive";

        var (connectionId, reader) = _realtime.Subscribe(userId);
        using var keepAlive = new PeriodicTimer(TimeSpan.FromSeconds(25));

        try
        {
            while (!ct.IsCancellationRequested)
            {
                var waitRead = reader.WaitToReadAsync(ct).AsTask();
                var waitPing = keepAlive.WaitForNextTickAsync(ct).AsTask();
                var completed = await Task.WhenAny(waitRead, waitPing);

                if (completed == waitPing)
                {
                    await Response.WriteAsync(": keepalive\n\n", ct);
                    await Response.Body.FlushAsync(ct);
                    continue;
                }

                if (!await waitRead)
                    break;

                while (reader.TryRead(out var notification))
                {
                    var json = JsonSerializer.Serialize(notification, JsonOpts);
                    await Response.WriteAsync($"data: {json}\n\n", ct);
                    await Response.Body.FlushAsync(ct);
                }
            }
        }
        finally
        {
            _realtime.Unsubscribe(userId, connectionId);
        }
    }

    [HttpPost]
    public async Task<ActionResult<UserNotificationDto>> Create(
        [FromBody] CreateUserNotificationRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest("title required");

        return Ok(await _notifications.CreateForUserAsync(userId, request, ct));
    }

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        return await _notifications.MarkReadAsync(userId, id, ct) ? NoContent() : NotFound();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        await _notifications.MarkAllReadAsync(userId, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        return await _notifications.DeleteAsync(userId, id, ct) ? NoContent() : NotFound();
    }

    [HttpDelete]
    public async Task<IActionResult> ClearAll(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        await _notifications.ClearForUserAsync(userId, ct);
        return NoContent();
    }

    private string? CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
}
