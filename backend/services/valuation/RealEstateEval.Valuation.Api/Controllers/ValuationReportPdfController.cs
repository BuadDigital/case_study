using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// Public side of a report PDF link: <c>GET /api/valuation-reports/{fileName}.pdf?k=…</c>.
/// No session — the signed, expiring key is the credential. Every failure is a 404 so the
/// endpoint neither confirms report numbers nor explains why a key was refused.
/// New copies are no longer rendered; this keeps links already shared opening.
/// </summary>
[ApiController]
[Route("api/valuation-reports")]
public class ValuationReportPdfLinkController : ControllerBase
{
    private readonly IValuationReportPdfService _pdfs;

    public ValuationReportPdfLinkController(IValuationReportPdfService pdfs) => _pdfs = pdfs;

    [HttpGet("{fileName}")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true)]
    public async Task<IActionResult> Open(
        string fileName,
        [FromQuery(Name = "k")] string? key,
        CancellationToken ct)
    {
        if (!IsSafeFileName(fileName) || string.IsNullOrWhiteSpace(key))
            return NotFound();

        var file = await _pdfs.OpenSharedAsync(fileName, key, ct);
        if (file is null)
            return NotFound();

        var etag = $"\"{file.Sha256}\"";
        if (Request.Headers.IfNoneMatch.Count > 0
            && Request.Headers.IfNoneMatch.ToString().Contains(etag, StringComparison.Ordinal))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        Response.Headers.ETag = etag;
        Response.Headers.CacheControl = "private, max-age=300";
        // inline (not attachment) so browsers open their PDF viewer instead of downloading.
        Response.Headers.ContentDisposition = $"inline; filename=\"{file.FileName}\"";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(file.Content, "application/pdf");
    }

    private static bool IsSafeFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 160) return false;
        if (!fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) return false;
        foreach (var c in fileName)
        {
            var ok = c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '_' or '-' or ',' or '.';
            if (!ok) return false;
        }
        return !fileName.Contains("..", StringComparison.Ordinal);
    }
}
