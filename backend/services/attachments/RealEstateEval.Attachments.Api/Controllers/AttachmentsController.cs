using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Attachments.Api.Controllers;

[ApiController]
[Route("api/attachments")]
[Authorize]
public class AttachmentsController : ControllerBase
{
    private readonly IAttachmentService _attachments;

    public AttachmentsController(IAttachmentService attachments) => _attachments = attachments;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FileAttachmentMetaDto>>> List(
        [FromQuery] string scope,
        [FromQuery] string scopeKey,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(scope) || string.IsNullOrWhiteSpace(scopeKey))
            return BadRequest(new { error = "scope and scopeKey are required" });

        return Ok(await _attachments.ListAsync(scope, scopeKey, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var (content, meta) = await _attachments.GetContentAsync(id, ct);
        if (content is null || meta is null) return NotFound();
        return File(content, meta.ContentType, meta.FileName);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> Upload(
        [FromBody] UploadAttachmentRequest request,
        CancellationToken ct)
    {
        byte[] _;
        try
        {
            _ = Convert.FromBase64String(request.ContentBase64);
        }
        catch
        {
            return BadRequest(new { error = "invalid base64 content" });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? "";

        var meta = await _attachments.UploadAsync(request, userId, ct);
        return CreatedAtAction(nameof(Download), new { id = meta.Id }, meta);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => await _attachments.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
