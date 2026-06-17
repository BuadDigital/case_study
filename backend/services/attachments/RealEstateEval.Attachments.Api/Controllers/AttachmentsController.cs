using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Attachments.Api.Controllers;

[ApiController]
[Route("api/attachments")]
[Authorize]
public class AttachmentsController : ControllerBase
{
    private const string BlobContainer = "attachments";
    private readonly ApplicationDbContext _db;
    private readonly IBlobStorage _blobs;

    public AttachmentsController(ApplicationDbContext db, IBlobStorage blobs)
    {
        _db = db;
        _blobs = blobs;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FileAttachmentMetaDto>>> List(
        [FromQuery] string scope,
        [FromQuery] string scopeKey,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(scope) || string.IsNullOrWhiteSpace(scopeKey))
            return BadRequest(new { error = "scope and scopeKey are required" });

        var rows = await _db.FileAttachments.AsNoTracking()
            .Where(x => x.Scope == scope.Trim() && x.ScopeKey == scopeKey.Trim())
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(ct);
        return Ok(rows.Select(ToMeta).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var row = await _db.FileAttachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();

        var content = await ReadContentAsync(row, ct);
        if (content is null) return NotFound();

        return File(content, row.ContentType, row.FileName);
    }

    [HttpPost]
    public async Task<ActionResult<FileAttachmentMetaDto>> Upload(
        [FromBody] UploadAttachmentRequest request,
        CancellationToken ct)
    {
        byte[] content;
        try
        {
            content = Convert.FromBase64String(request.ContentBase64);
        }
        catch
        {
            return BadRequest(new { error = "invalid base64 content" });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? "";

        var id = Guid.NewGuid();
        var safeName = Path.GetFileName(request.FileName.Trim());
        if (string.IsNullOrWhiteSpace(safeName))
            safeName = "file";

        var storageKey = await _blobs.SaveAsync(
            BlobContainer,
            $"{id:N}/{safeName}",
            content,
            ct);

        var row = new FileAttachment
        {
            Id = id,
            Scope = request.Scope.Trim(),
            ScopeKey = request.ScopeKey.Trim(),
            FileName = safeName,
            ContentType = string.IsNullOrWhiteSpace(request.ContentType)
                ? "application/octet-stream"
                : request.ContentType.Trim(),
            StorageKey = storageKey,
            Content = null,
            SizeBytes = content.LongLength,
            UploadedByUserId = userId,
            CreatedAtUtc = DateTime.UtcNow,
        };
        _db.FileAttachments.Add(row);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Download), new { id = row.Id }, ToMeta(row));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var row = await _db.FileAttachments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(row.StorageKey))
            await _blobs.DeleteAsync(row.StorageKey, ct);

        _db.FileAttachments.Remove(row);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<byte[]?> ReadContentAsync(FileAttachment row, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(row.StorageKey))
            return await _blobs.ReadAsync(row.StorageKey, ct);

        return row.Content;
    }

    private static FileAttachmentMetaDto ToMeta(FileAttachment row) => new()
    {
        Id = row.Id,
        Scope = row.Scope,
        ScopeKey = row.ScopeKey,
        FileName = row.FileName,
        ContentType = row.ContentType,
        SizeBytes = row.SizeBytes > 0 ? row.SizeBytes : row.Content?.LongLength ?? 0,
        CreatedAtUtc = row.CreatedAtUtc,
    };
}
