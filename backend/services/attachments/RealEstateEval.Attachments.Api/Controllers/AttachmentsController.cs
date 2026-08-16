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
    private readonly ILogger<AttachmentsController> _logger;

    public AttachmentsController(
        IAttachmentService attachments,
        ILogger<AttachmentsController> logger)
    {
        _attachments = attachments;
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
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var (content, meta) = await _attachments.GetContentAsync(id, ct);
        if (content is null || meta is null) return NotFound();
        return File(content, meta.ContentType, meta.FileName);
    }

    [HttpGet("{id:guid}/meta")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> GetMeta(Guid id, CancellationToken ct)
    {
        var meta = await _attachments.GetMetaAsync(id, ct);
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

    [HttpPatch("{id:guid}/classify")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> Classify(
        Guid id,
        [FromBody] ClassifyAttachmentRequest request,
        CancellationToken ct)
    {
        var (meta, error) = await _attachments.ClassifyAsync(id, request, ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return meta is null ? NotFound() : Ok(meta);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => await _attachments.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
