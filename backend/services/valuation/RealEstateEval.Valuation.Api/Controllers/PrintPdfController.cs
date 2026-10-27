using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// Turns a print page built in the browser into a PDF file, so a document that only exists as a print page
/// (the issued case-study report) can be downloaded and uploaded to Enfaz like the final valuation report.
/// </summary>
/// <remarks>
/// How it works: the browser sends the page with every image, style and font already embedded; the same
/// Gotenberg renderer that builds the final valuation report prints it on A4 and the PDF bytes come back
/// directly. Nothing is stored.
/// Edge cases: an empty or oversized page is refused with an Arabic message; the renderer being down or
/// unconfigured answers 503 so the screen can say «حاول لاحقاً»; a page the renderer cannot print answers 400.
/// The renderer has no network access, so a page with external links cannot reach anything.
/// </remarks>
[ApiController]
[Route("api/print-pdf")]
[Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
public sealed class PrintPdfController(IHtmlPdfRenderer renderer) : ControllerBase
{
    /// <summary>Upper bound for one page: a report with embedded fonts and letterhead is well under 5 MB.</summary>
    private const int MaxHtmlChars = 20 * 1024 * 1024;

    [HttpPost]
    public async Task<IActionResult> Render([FromBody] RenderPrintPdfRequest request, CancellationToken ct)
    {
        var html = request.Html;
        if (string.IsNullOrWhiteSpace(html))
            return this.BadRequestProblem("محتوى الصفحة المطلوب طباعتها فارغ.");
        if (html.Length > MaxHtmlChars)
            return this.BadRequestProblem("الصفحة المطلوب طباعتها كبيرة جداً.");
        if (!renderer.IsConfigured)
            return this.ServiceUnavailableProblem("خدمة إنشاء ملفات PDF غير متاحة حالياً — حاول لاحقاً.");

        try
        {
            var bytes = await renderer.RenderAsync(html, ct);
            return File(bytes, "application/pdf");
        }
        catch (HtmlPdfRendererUnavailableException)
        {
            return this.ServiceUnavailableProblem("خدمة إنشاء ملفات PDF غير متاحة حالياً — حاول لاحقاً.");
        }
        catch (HtmlPdfRenderFailedException)
        {
            return this.BadRequestProblem("تعذّر تحويل الصفحة إلى ملف PDF.");
        }
    }
}
