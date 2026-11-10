namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// A rendered PDF of the valuation report HTML, once served from signed <c>…/{reportNumber}.pdf?k=…</c>
/// links. The links and their endpoint were removed on 2026-11-10 (the table held no rows); the entity
/// stays only so the EF model, and with it the <c>ValuationReportPdfs</c> table, does not change.
/// Nothing reads or writes it.
/// </summary>
public class ValuationReportPdf
{
    public Guid Id { get; private set; }
    public Guid ValuationRequestId { get; private set; }

 /// <summary>Report number printed on the document — becomes the file name.</summary>
    public string ReportNumber { get; private set; } = "";

 /// <summary>Safe file name (ASCII, ends with .pdf) used in the public link.</summary>
    public string FileName { get; private set; } = "";

    public byte[] Content { get; private set; } = [];
    public long SizeBytes { get; private set; }

 /// <summary>Lower-case hex SHA-256 of <see cref="Content"/> — ETag and integrity check.</summary>
    public string Sha256 { get; private set; } = "";

    public DateTime CreatedAtUtc { get; private set; }
    public string? CreatedByUserId { get; private set; }

 /// <summary>Which renderer produced the bytes (e.g. "gotenberg-chromium").</summary>
    public string Renderer { get; private set; } = "";

    private ValuationReportPdf()
    {
    }
}

/// <summary>Pure rules for the report HTML sent for PDF rendering.</summary>
public static class ValuationReportPdfRules
{
 /// <summary>Upper bound for the posted HTML (the browser embeds photos as data URLs).</summary>
    public const int MaxHtmlBytes = 64 * 1024 * 1024;
}
