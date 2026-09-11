using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Attachments.Application.Contracts;
using RealEstateEval.Attachments.Application.Abstractions;

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
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        var (content, meta) = await _attachments.GetContentAsync(id, actor, ct);
        if (content is null || meta is null) return NotFound();
        return File(content, meta.ContentType, meta.FileName);
    }

    [HttpGet("{id:guid}/meta")]
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
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

        if (string.Equals(request.Scope?.Trim(), PropertyDocumentTypes.GovernedScope, StringComparison.Ordinal))
        {
            var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
            if (!PoRoleMatrixRules.CanUploadPropertyDocuments(actor?.PrototypeRole))
                return this.ForbiddenProblem("رفع مستندات العقار متاح للأخصائي ومشرف القسم");
        }

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

    [HttpPut("{id:guid}/document-type")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> SetDocumentType(
        Guid id,
        [FromBody] SetAttachmentDocumentTypeRequest request,
        CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (!PoRoleMatrixRules.CanUploadPropertyDocuments(actor?.PrototypeRole))
            return this.ForbiddenProblem("تصنيف مستندات العقار متاح للأخصائي ومشرف القسم");

        var (meta, error) = await _attachments.SetDocumentTypeAsync(id, request, actor, ct);
        if (error is not null) return this.BadRequestProblem(error);
        return meta is null ? NotFound() : Ok(meta);
    }

    [HttpPost("{id:guid}/review")]
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> ReviewDocument(
        Guid id,
        [FromBody] ReviewAttachmentDocumentRequest request,
        CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (!PoRoleMatrixRules.CanReviewUnlistedDocuments(actor?.PrototypeRole))
            return this.ForbiddenProblem("مراجعة المستندات غير المعرّفة متاحة لمشرف القسم والإدارة");

        var (meta, error) = await _attachments.ReviewDocumentAsync(id, request, actor, ct);
        if (error is not null) return this.BadRequestProblem(error);
        return meta is null ? NotFound() : Ok(meta);
    }

    [HttpGet("lookup")]
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
    public async Task<ActionResult<IReadOnlyList<AttachmentRefDto>>> Lookup(
        [FromQuery] string ids,
        CancellationToken ct)
    {
        var parsed = ParseIds(ids);
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(await _lookup.GetRefsAsync(parsed, actor, ct));
    }

    [HttpGet("for-property")]
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
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
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
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