using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>
/// Report HTML as the browser rendered it (self-contained: images, letterhead and fonts as
/// data URLs) to be turned into a PDF and served from a <c>.pdf?k=…</c> link.
/// </summary>
public class CreateValuationReportPdfRequest
{
    // AddValidation is off for this service, so this message is what reaches the appraiser
    // verbatim if the request is ever built with an empty body — must be Arabic.
    [Required(ErrorMessage = "محتوى التقرير فارغ — أعد المحاولة بعد تحميل المعاينة.")]
    public string Html { get; init; } = "";

 /// <summary>Report number shown on the document — used for the file name. Optional.</summary>
    [MaxLength(128)]
    public string? ReportNumber { get; init; }
}

/// <summary>A stored report PDF plus the signed link that opens it without a session.</summary>
public class ValuationReportPdfLinkDto
{
    public Guid PdfId { get; init; }
    public Guid ValuationRequestId { get; init; }
    public string ReportNumber { get; init; } = "";
    public string FileName { get; init; } = "";

 /// <summary>Relative URL: <c>/api/valuation-reports/{fileName}?k={token}</c>. Prefix with the API origin.</summary>
    public string Url { get; init; } = "";

    public string ExpiresAtUtc { get; init; } = "";
    public string CreatedAtUtc { get; init; } = "";
    public long SizeBytes { get; init; }
    public string Sha256 { get; init; } = "";
}
