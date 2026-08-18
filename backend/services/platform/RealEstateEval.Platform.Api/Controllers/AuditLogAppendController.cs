using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/audit-log")]
[Authorize]
public sealed class AuditLogAppendController(IAuditLogAppend audit,
    TimeProvider? time = null) : ControllerBase
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    [HttpPost("append")]
    public async Task<IActionResult> Append(
        [FromBody] AppendAuditLogRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ActorId)
            || string.IsNullOrWhiteSpace(request.Action)
            || string.IsNullOrWhiteSpace(request.EntityType)
            || string.IsNullOrWhiteSpace(request.EntityId))
        {
            return this.BadRequestProblem("actorId, action, entityType, and entityId are required");
        }

        await audit.AppendAsync(
            new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorId = request.ActorId.Trim(),
                Action = request.Action.Trim(),
                EntityType = request.EntityType.Trim(),
                EntityId = request.EntityId.Trim(),
                BeforeJson = string.IsNullOrWhiteSpace(request.BeforeJson) ? "null" : request.BeforeJson,
                AfterJson = string.IsNullOrWhiteSpace(request.AfterJson) ? "null" : request.AfterJson,
                CreatedAtUtc = request.CreatedAtUtc ?? _time.UtcNow(),
            },
            cancellationToken);
        return NoContent();
    }
}
