using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Shared.Web;
using RealEstateEval.Platform.Infrastructure.Notifications;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController : ControllerBase
{
    private static readonly TimeSpan StreamKeepAliveInterval = TimeSpan.FromSeconds(25);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly INotificationService _notifications;
    private readonly NotificationRealtimeHub _realtime;
    private readonly DatabaseOptions _dbOptions;

    public NotificationsController(
        INotificationService notifications,
        NotificationRealtimeHub realtime,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _notifications = notifications;
        _realtime = realtime;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

 /// <summary>
 /// The signed-in user's notifications. Sending page or pageSize returns PagedResultDto; without
 /// them the response stays the plain array the bell has always read, capped at 50 rows. The SSE
 /// stream below is untouched. See docs/architecture/pagination-contract.md §6.
 /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? sort,
        [FromQuery] string? dir,
        [FromQuery] string? q,
        [FromQuery] string? category,
        [FromQuery] bool? unread,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var query = new NotificationListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            Category = category,
            Unread = unread,
        };

        if (!query.IsPaged)
            return Ok(await _notifications.ListForUserAsync(userId, query, ct));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page,
            query.PageSize,
            _dbOptions);
        return Ok(await _notifications.ListPagedForUserAsync(
            userId, query, skip, take, resolvedPage, ct));
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

        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var readTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                readTimeout.CancelAfter(StreamKeepAliveInterval);

                try
                {
                    if (!await reader.WaitToReadAsync(readTimeout.Token))
                        break;

                    while (reader.TryRead(out var notification))
                    {
                        var json = JsonSerializer.Serialize(notification, JsonOpts);
                        await Response.WriteAsync($"data: {json}\n\n", ct);
                        await Response.Body.FlushAsync(ct);
                    }
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    break;
                }
                catch (OperationCanceledException)
                {
                    await Response.WriteAsync(": keepalive\n\n", ct);
                    await Response.Body.FlushAsync(ct);
                }
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
 // Client closed the tab or the host is shutting down (e.g. dev-api restart).
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
        if (string.IsNullOrWhiteSpace(request.Title)) return this.BadRequestProblem("title required");

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

    private string? CurrentUserId()
    {
        var id = ActorClaims.Id(User);
        return id is "unknown" or "" ? null : id;
    }
}
