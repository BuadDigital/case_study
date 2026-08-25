using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Attachments.Api.Controllers;

[ApiController]
[Route("api/attachments")]
[Authorize]
public class AttachmentsController : ControllerBase
{
    private readonly IAttachmentService _attachments;
    private readonly IAttachmentLookup _lookup;
    private readonly IPermissionService _permissions;
    private readonly ILogger<AttachmentsController> _logger;

    public AttachmentsController(
        IAttachmentService attachments,
        IAttachmentLookup lookup,
        IPermissionService permissions,
        ILogger<AttachmentsController> logger)
    {
        _attachments = attachments;
        _lookup = lookup;
        _permissions = permissions;
        _logger = logger;
    }

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<IReadOnlyList<FileAttachmentMetaDto>>> List(
        [FromQuery] string scope,
        [FromQuery] string scopeKey,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(scope) || string.IsNullOrWhiteSpace(scopeKey))
            return this.BadRequestProblem("scope and scopeKey are required");

        return Ok(await _attachments.ListAsync(scope, scopeKey, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        var (content, meta) = await _attachments.GetContentAsync(id, actor, ct);
        if (content is null || meta is null) return NotFound();
        return File(content, meta.ContentType, meta.FileName);
    }

    [HttpGet("{id:guid}/meta")]
    public async Task<ActionResult<FileAttachmentMetaDto>> GetMeta(Guid id, CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        var meta = await _attachments.GetMetaAsync(id, actor, ct);
        return meta is null ? NotFound() : Ok(meta);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> Upload(
        [FromBody] UploadAttachmentRequest request,
        CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        if (userId is "unknown") userId = "";

        var (meta, error) = await _attachments.UploadAsync(request, userId, ct);
        if (error is not null)
        {
            _logger.LogInformation(
                "Rejected attachment upload for scope {Scope} by user {UserId}: {Reason}",
                request.Scope,
                userId,
                error);
            return this.BadRequestProblem(error);
        }

        return CreatedAtAction(nameof(Download), new { id = meta!.Id }, meta);
    }

    [HttpGet("lookup")]
    public async Task<ActionResult<IReadOnlyList<AttachmentRefDto>>> Lookup(
        [FromQuery] string ids,
        CancellationToken ct)
    {
        var parsed = ParseIds(ids);
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(await _lookup.GetRefsAsync(parsed, actor, ct));
    }

    [HttpGet("for-property")]
    public async Task<ActionResult<IReadOnlyList<FileAttachmentMetaDto>>> ForProperty(
        [FromQuery] string propertyId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(propertyId))
            return this.BadRequestProblem("propertyId is required");

        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(await _lookup.ListForPropertyAsync(propertyId, actor, ct));
    }

    [HttpGet("{id:guid}/exists")]
    public async Task<ActionResult<AttachmentExistsDto>> Exists(Guid id, CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(new AttachmentExistsDto { Exists = await _lookup.ExistsAsync(id, actor, ct) });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return await _attachments.DeleteAsync(id, actor, ct) ? NoContent() : NotFound();
    }

    private static IReadOnlyList<Guid> ParseIds(string? ids)
    {
        if (string.IsNullOrWhiteSpace(ids))
            return [];

        return ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => Guid.TryParse(part, out var id) ? id : (Guid?)null)
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .Distinct()
            .Take(200)
            .ToList();
    }
}
