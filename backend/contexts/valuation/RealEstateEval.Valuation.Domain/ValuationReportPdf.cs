namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// A rendered PDF of the valuation report HTML (the v3 template the appraiser sees on screen),
/// kept so the report can be opened from a plain <c>…/{reportNumber}.pdf?k=…</c> link
/// in the browser's PDF viewer or shared without a session (signed, expiring key).
/// Immutable once stored: a re-render creates a new row; old links keep showing what was shared.
/// Only the most recent few rows per request are retained (see ValuationReportPdfRules.KeepPerRequest).
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

    public static ValuationReportPdf Create(
        Guid valuationRequestId,
        string reportNumber,
        string fileName,
        byte[] content,
        string sha256,
        string renderer,
        string? createdByUserId,
        DateTime nowUtc)
    {
        ArgumentNullException.ThrowIfNull(content);
        if (content.Length == 0)
            throw new ArgumentException("PDF content is empty.", nameof(content));
        if (string.IsNullOrWhiteSpace(fileName) || !fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("File name must end with .pdf.", nameof(fileName));

        return new ValuationReportPdf
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = valuationRequestId,
            ReportNumber = (reportNumber ?? "").Trim(),
            FileName = fileName.Trim(),
            Content = content,
            SizeBytes = content.LongLength,
            Sha256 = (sha256 ?? "").Trim().ToLowerInvariant(),
            Renderer = (renderer ?? "").Trim(),
            CreatedByUserId = string.IsNullOrWhiteSpace(createdByUserId) ? null : createdByUserId.Trim(),
            CreatedAtUtc = nowUtc,
        };
    }
}

/// <summary>Pure rules for report PDF links and file names.</summary>
public static class ValuationReportPdfRules
{
 /// <summary>Rendered copies kept per valuation request; older ones are deleted on the next render.</summary>
    public const int KeepPerRequest = 3;

 /// <summary>Default link lifetime when <c>ReportPdfLinks:LifetimeDays</c> is not configured.</summary>
    public const int DefaultLinkLifetimeDays = 90;

 /// <summary>Upper bound for the posted HTML (the browser embeds photos as data URLs).</summary>
    public const int MaxHtmlBytes = 64 * 1024 * 1024;

 /// <summary>
 /// <c>{reportNumber}.pdf</c> with only URL-safe ASCII kept, so the link reads like the
 /// legacy <c>…/print-valuation-pdf/051421.pdf</c>. Falls back to the display id, then to a constant.
 /// </summary>
    public static string BuildFileName(string? reportNumber, string? displayId)
    {
        var stem = Sanitize(reportNumber);
        if (stem.Length == 0) stem = Sanitize(displayId);
        if (stem.Length == 0) stem = "valuation-report";
        return stem + ".pdf";
    }

    private static string Sanitize(string? value)
    {
        var t = (value ?? "").Trim();
        if (t.Length == 0) return "";
        var chars = new char[t.Length];
        var n = 0;
        var lastDash = false;
        foreach (var c in t)
        {
            var ok = c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '_' or '-' or ',' or '.';
            if (ok)
            {
                chars[n++] = c;
                lastDash = false;
            }
            else if (!lastDash)
            {
                chars[n++] = '-';
                lastDash = true;
            }
        }
        var s = new string(chars, 0, n).Trim('-', '.');
        return s.Length > 96 ? s[..96].TrimEnd('-', '.') : s;
    }
}
