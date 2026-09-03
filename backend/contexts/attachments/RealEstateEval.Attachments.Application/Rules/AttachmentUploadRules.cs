using System.Buffers;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Attachments.Application.Rules;

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

 /// <summary>
 /// Result of a content-verified upload check. <see cref="Error"/> is non-null exactly
 /// when the upload must be rejected; otherwise the caller must persist
 /// <see cref="ContentType"/> and <see cref="FileName"/> instead of what the client sent.
 /// </summary>
    public sealed record InspectedUpload(
        string? Error,
        DetectedFileFormat Format,
        string ContentType,
        string FileName);

 /// <summary>
 /// Full upload gate: identifies the content from its own bytes, requires the declared
 /// MIME type and the file-name extension to agree with it, then applies the scope's
 /// format and size budget. Everything outside the allow-list is rejected.
 /// </summary>
    public static InspectedUpload Inspect(
        string scope,
        string? declaredContentType,
        string? fileName,
        ReadOnlySpan<byte> content)
    {
        var format = FileSignatureInspector.Detect(content);
        var safeName = SanitizeFileName(fileName, format);

        if (content.Length <= 0)
            return Reject("حجم الملف غير صالح", format, safeName);

        if (format == DetectedFileFormat.Unknown)
        {
            return Reject(
                "محتوى الملف غير مدعوم — يُسمح بصور JPEG/PNG/GIF/WebP أو ملفات PDF فقط",
                format,
                safeName);
        }

        var declared = (declaredContentType ?? "").Trim();
        var declaredIsSpecific =
            declared.Length > 0
            && !string.Equals(declared, "application/octet-stream", StringComparison.OrdinalIgnoreCase);
        if (declaredIsSpecific && !FileSignatureInspector.MatchesDeclaredMime(format, declared))
            return Reject("نوع المحتوى المعلن لا يطابق محتوى الملف", format, safeName);

        var extension = Path.GetExtension(safeName);
        if (string.IsNullOrEmpty(extension))
            return Reject("اسم الملف يجب أن ينتهي بامتداد معروف", format, safeName);
        if (!FileSignatureInspector.MatchesExtension(format, extension))
            return Reject("امتداد الملف لا يطابق محتوى الملف", format, safeName);

 // Scope + size budget is judged on the verified type, never the declared one.
        var verifiedMime = FileSignatureInspector.CanonicalMime(format);
        var scopeError = Validate(scope, verifiedMime, content.Length, safeName);
        if (scopeError is not null)
            return Reject(scopeError, format, safeName);

        return new InspectedUpload(null, format, verifiedMime, safeName);
    }

 /// <summary>
 /// Strips any directory component — including Windows-style separators, which
 /// <see cref="Path.GetFileName(string)"/> ignores on Linux — and any character that
 /// has no business in a stored file name.
 /// </summary>
    public static string SanitizeFileName(string? fileName, DetectedFileFormat format)
    {
        var name = (fileName ?? "").Trim();
        var lastSeparator = name.LastIndexOfAny(['/', '\\', ':']);
        if (lastSeparator >= 0)
            name = name[(lastSeparator + 1)..];

        var cleaned = new string([.. name.Where(c =>
            !char.IsControl(c) && !InvalidFileNameChars.Contains(c))]).Trim().Trim('.');

        if (cleaned.Length > 200)
            cleaned = cleaned[^200..];

        if (cleaned.Length == 0)
            cleaned = "file" + FileSignatureInspector.CanonicalExtension(format);

        return cleaned;
    }

    private static readonly SearchValues<char> InvalidFileNameChars =
        SearchValues.Create("<>:\"/\\|?*\0");

    private static InspectedUpload Reject(string error, DetectedFileFormat format, string fileName) =>
        new(error, format, FileSignatureInspector.CanonicalMime(format), fileName);

 /// <summary>
 /// Metadata-only gate (scope allow-list plus size budget). Callers handling real bytes
 /// must use <see cref="Inspect"/>, which additionally verifies the content itself.
 /// </summary>
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
