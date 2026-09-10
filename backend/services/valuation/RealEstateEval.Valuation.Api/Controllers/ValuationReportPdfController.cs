using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// Report PDF copies: the browser posts the report HTML it rendered (print copy, self-contained),
/// the service turns it into a PDF and answers with a signed link that opens in any PDF viewer.
/// </summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/report-pdf")]
[Authorize]
public class ValuationReportPdfController : ControllerBase
{
    private readonly IValuationReportPdfService _pdfs;

    public ValuationReportPdfController(IValuationReportPdfService pdfs) => _pdfs = pdfs;

    // A write, so it stays on the write policy like every other report mutation: the stored copy
    // is what the GET below and the public `?k=…` link serve, and the posted HTML is never
    // re-derived from stored data. read-valuation-report also grants manage-work-orders, which
    // would let case staff publish a report body under an appraiser's report number.
    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    [RequestSizeLimit(ValuationReportPdfRules.MaxHtmlBytes + 1024 * 1024)]
    public async Task<ActionResult<ValuationReportPdfLinkDto>> Create(
        Guid valuationRequestId,
        [FromBody] CreateValuationReportPdfRequest request,
        CancellationToken ct)
    {
        var result = await _pdfs.CreateFromHtmlAsync(
            valuationRequestId,
            request,
            ActorClaims.TryId(User),
            ct);

        return result.Failure switch
        {
            ValuationReportPdfFailure.None => Ok(result.Link),
            ValuationReportPdfFailure.RequestNotFound => this.NotFoundProblem(result.MessageAr ?? "Not Found"),
            ValuationReportPdfFailure.InvalidHtml or ValuationReportPdfFailure.HtmlTooLarge =>
                this.BadRequestProblem(result.MessageAr ?? "Bad Request"),
            ValuationReportPdfFailure.RendererUnavailable => Problem(
                detail: result.MessageAr,
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "PDF renderer unavailable"),
            _ => Problem(
                detail: result.MessageAr,
                statusCode: StatusCodes.Status502BadGateway,
                title: "PDF render failed"),
        };
    }

 /// <summary>Signed link of the newest stored copy (re-signed with a fresh expiry).</summary>
    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<ValuationReportPdfLinkDto>> GetLatest(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var link = await _pdfs.GetLatestLinkAsync(valuationRequestId, ct);
        return link is null ? NotFound() : Ok(link);
    }
}

/// <summary>
/// Public side of the link: <c>GET /api/valuation-reports/{fileName}.pdf?k=…</c>.
/// No session — the signed, expiring key is the credential. Every failure is a 404 so the
/// endpoint neither confirms report numbers nor explains why a key was refused.
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
