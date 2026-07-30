namespace RealEstateEval.Application.Rules;

/// <summary>Formats the platform is willing to store and serve back.</summary>
public enum DetectedFileFormat
{
    Unknown = 0,
    Jpeg,
    Png,
    Gif,
    Webp,
    Pdf,
}

/// <summary>
/// Identifies uploaded content from its leading bytes rather than from the caller's
/// declared MIME type or file name, both of which are attacker-controlled.
/// Anything not positively recognised is <see cref="DetectedFileFormat.Unknown"/> and
/// must be rejected — the allow-list is the whole security boundary here.
/// </summary>
public static class FileSignatureInspector
{
    /// <summary>Longest signature we need to look at (RIFF/WEBP needs 12 bytes).</summary>
    public const int MinimumInspectableBytes = 12;

    private static readonly byte[] PngSignature =
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static readonly byte[] JpegSignature = [0xFF, 0xD8, 0xFF];

    private static readonly byte[] Gif87Signature = "GIF87a"u8.ToArray();
    private static readonly byte[] Gif89Signature = "GIF89a"u8.ToArray();
    private static readonly byte[] RiffSignature = "RIFF"u8.ToArray();
    private static readonly byte[] WebpSignature = "WEBP"u8.ToArray();
    private static readonly byte[] PdfSignature = "%PDF-"u8.ToArray();

    public static DetectedFileFormat Detect(ReadOnlySpan<byte> content)
    {
        if (content.IsEmpty)
            return DetectedFileFormat.Unknown;

        if (StartsWith(content, PngSignature))
            return DetectedFileFormat.Png;
        if (StartsWith(content, JpegSignature))
            return DetectedFileFormat.Jpeg;
        if (StartsWith(content, Gif87Signature) || StartsWith(content, Gif89Signature))
            return DetectedFileFormat.Gif;
        if (StartsWith(content, RiffSignature)
            && content.Length >= 12
            && content.Slice(8, 4).SequenceEqual(WebpSignature))
        {
            return DetectedFileFormat.Webp;
        }

        // Offset 0 only: tolerating leading junk is what makes PDF polyglots work.
        if (StartsWith(content, PdfSignature))
            return DetectedFileFormat.Pdf;

        return DetectedFileFormat.Unknown;
    }

    /// <summary>The single MIME type this platform stores for a verified format.</summary>
    public static string CanonicalMime(DetectedFileFormat format) => format switch
    {
        DetectedFileFormat.Jpeg => "image/jpeg",
        DetectedFileFormat.Png => "image/png",
        DetectedFileFormat.Gif => "image/gif",
        DetectedFileFormat.Webp => "image/webp",
        DetectedFileFormat.Pdf => "application/pdf",
        _ => "application/octet-stream",
    };

    /// <summary>MIME types a client may legitimately declare for a verified format.</summary>
    public static bool MatchesDeclaredMime(DetectedFileFormat format, string declaredMime)
    {
        var mime = declaredMime.Trim();
        return format switch
        {
            DetectedFileFormat.Jpeg =>
                Same(mime, "image/jpeg") || Same(mime, "image/jpg") || Same(mime, "image/pjpeg"),
            DetectedFileFormat.Png => Same(mime, "image/png"),
            DetectedFileFormat.Gif => Same(mime, "image/gif"),
            DetectedFileFormat.Webp => Same(mime, "image/webp"),
            DetectedFileFormat.Pdf =>
                Same(mime, "application/pdf") || Same(mime, "application/x-pdf"),
            _ => false,
        };
    }

    /// <summary>File-name extensions consistent with a verified format.</summary>
    public static bool MatchesExtension(DetectedFileFormat format, string extension)
    {
        var ext = extension.Trim();
        return format switch
        {
            DetectedFileFormat.Jpeg =>
                Same(ext, ".jpg") || Same(ext, ".jpeg") || Same(ext, ".jpe"),
            DetectedFileFormat.Png => Same(ext, ".png"),
            DetectedFileFormat.Gif => Same(ext, ".gif"),
            DetectedFileFormat.Webp => Same(ext, ".webp"),
            DetectedFileFormat.Pdf => Same(ext, ".pdf"),
            _ => false,
        };
    }

    public static string CanonicalExtension(DetectedFileFormat format) => format switch
    {
        DetectedFileFormat.Jpeg => ".jpg",
        DetectedFileFormat.Png => ".png",
        DetectedFileFormat.Gif => ".gif",
        DetectedFileFormat.Webp => ".webp",
        DetectedFileFormat.Pdf => ".pdf",
        _ => "",
    };

    public static bool IsImage(DetectedFileFormat format) =>
        format is DetectedFileFormat.Jpeg
            or DetectedFileFormat.Png
            or DetectedFileFormat.Gif
            or DetectedFileFormat.Webp;

    private static bool StartsWith(ReadOnlySpan<byte> content, ReadOnlySpan<byte> signature) =>
        content.Length >= signature.Length
        && content[..signature.Length].SequenceEqual(signature);

    private static bool Same(string left, string right) =>
        string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
}
