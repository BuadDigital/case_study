using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side MIME / size gates for <c>/api/attachments</c>.
/// Unknown scopes fall back to a conservative default allow-list.
/// </summary>
public static class AttachmentUploadRules
{
    public const long DefaultMaxBytes = 20 * 1024 * 1024;
    public const long ImageMaxBytes = 8 * 1024 * 1024;
    public const long PdfMaxBytes = 20 * 1024 * 1024;

    private static readonly HashSet<string> ImageMime = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    };

    private static readonly HashSet<string> PdfMime = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
    };

    private static readonly HashSet<string> ImageOrPdfScopes = new(StringComparer.OrdinalIgnoreCase)
    {
        "property-decree",
        "property-delegation",
        "property-other",
        "property-registry",
        "property-boundaries",
        "government-keys-proof",
        "field-inspection-photo",
        "key-envelope-receipt",
        "key-envelope-photo",
        "property-enabling-letter",
        "property-eviction-notice",
    };

    private static readonly HashSet<string> PdfOnlyScopes = new(StringComparer.OrdinalIgnoreCase)
    {
        "engineering-survey-report",
        "engineering-site-letter",
        "evaluator-report",
        "evaluator-plan-image",
    };

    public static string? Validate(string scope, string contentType, long sizeBytes, string? fileName = null)
    {
        if (sizeBytes <= 0)
            return "حجم الملف غير صالح";

        var normalizedScope = scope?.Trim() ?? "";
        var mime = string.IsNullOrWhiteSpace(contentType)
            ? GuessMimeFromFileName(fileName)
            : contentType.Trim();

        if (PdfOnlyScopes.Contains(normalizedScope))
        {
            if (!IsPdf(mime, fileName))
                return "يُسمح بملفات PDF فقط لهذا النوع من المرفقات";
            if (sizeBytes > PdfMaxBytes)
                return "حجم ملف PDF يتجاوز 20 ميجابايت";
            return null;
        }

        if (ImageOrPdfScopes.Contains(normalizedScope)
            || string.Equals(normalizedScope, FieldInspectionScopes.Photo, StringComparison.OrdinalIgnoreCase))
        {
            var isImage = IsImage(mime);
            var isPdf = IsPdf(mime, fileName);
            if (!isImage && !isPdf)
                return "يُسمح بالصور أو PDF فقط";
            if (isImage && sizeBytes > ImageMaxBytes)
                return "حجم الصورة يتجاوز 8 ميجابايت";
            if (isPdf && sizeBytes > PdfMaxBytes)
                return "حجم ملف PDF يتجاوز 20 ميجابايت";
            return null;
        }

        // Default: images + PDF, 20 MB cap.
        if (!IsImage(mime) && !IsPdf(mime, fileName))
            return "نوع الملف غير مدعوم";
        if (sizeBytes > DefaultMaxBytes)
            return "حجم الملف يتجاوز 20 ميجابايت";
        return null;
    }

    public static bool IsImage(string? mime) =>
        !string.IsNullOrWhiteSpace(mime)
        && (ImageMime.Contains(mime) || mime.StartsWith("image/", StringComparison.OrdinalIgnoreCase));

    public static bool IsPdf(string? mime, string? fileName = null)
    {
        if (!string.IsNullOrWhiteSpace(mime) && PdfMime.Contains(mime))
            return true;
        return (fileName ?? "").EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
    }

    static string GuessMimeFromFileName(string? fileName)
    {
        var name = (fileName ?? "").ToLowerInvariant();
        if (name.EndsWith(".pdf")) return "application/pdf";
        if (name.EndsWith(".png")) return "image/png";
        if (name.EndsWith(".jpg") || name.EndsWith(".jpeg")) return "image/jpeg";
        if (name.EndsWith(".gif")) return "image/gif";
        if (name.EndsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }
}
