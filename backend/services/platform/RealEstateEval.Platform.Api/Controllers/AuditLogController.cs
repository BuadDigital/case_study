using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/audit-log")]
[Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
public sealed class AuditLogController(IAuditLogQueryService auditLog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AuditLogPageDto>> List(
        [FromQuery] string? entityType,
        [FromQuery] string? entityId,
        [FromQuery] string? action,
        [FromQuery] string? actorId,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
        => Ok(await auditLog.ListAsync(
            entityType,
            entityId,
            action,
            actorId,
            page,
            limit,
            cancellationToken));
}
