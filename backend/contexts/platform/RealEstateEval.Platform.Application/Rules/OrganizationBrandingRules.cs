using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Platform.Application.Rules;

/// <summary>
/// Brand-identity rules on save: print sizes and letterhead margins must describe a usable A4
/// page, and every image must be an uploaded PNG / JPG / SVG within its size budget (or a
/// same-origin asset path). SVGs carrying script or external references are refused because
/// the images are embedded in printed reports. Audit snapshots keep a fingerprint of each
/// inline image instead of the bytes.
/// </summary>
public static partial class OrganizationBrandingRules
{
    public const int LogoMaxBytes = 512 * 1024;
    public const int StampMaxBytes = 1024 * 1024;
    public const int SignatureMaxBytes = 1024 * 1024;
    public const int LetterheadMaxBytes = 3 * 1024 * 1024;

    private const decimal A4WidthMm = 210m;
    private const decimal A4HeightMm = 297m;

    [GeneratedRegex(
        """<script|<foreignobject|\bon[a-z]+\s*=|javascript:|href\s*=\s*["']?\s*(?:https?:|//)""",
        RegexOptions.IgnoreCase)]
    private static partial Regex UnsafeSvgPattern();

    /// <summary>Throws <see cref="ArgumentOutOfRangeException"/> with an Arabic message (400 at the API).</summary>
    public static void Validate(OrganizationBrandingSettingsDto b)
    {
        Cm(b.StampWidthCm, nameof(b.StampWidthCm), "عرض الختم");
        Cm(b.StampHeightCm, nameof(b.StampHeightCm), "ارتفاع الختم");
        Cm(b.SignatureWidthCm, nameof(b.SignatureWidthCm), "عرض التوقيع");
        Cm(b.SignatureHeightCm, nameof(b.SignatureHeightCm), "ارتفاع التوقيع");

        Mm(b.LetterheadHeadMm, nameof(b.LetterheadHeadMm), "الهامش الأعلى", A4HeightMm);
        Mm(b.LetterheadFootTopMm, nameof(b.LetterheadFootTopMm), "الهامش الأسفل", A4HeightMm);
        Mm(b.LetterheadPadMm, nameof(b.LetterheadPadMm), "الهامش الأيسر", A4WidthMm);
        Mm(b.LetterheadPadStartMm, nameof(b.LetterheadPadStartMm), "الهامش الأيمن", A4WidthMm);
        Mm(b.LetterheadStripMm, nameof(b.LetterheadStripMm), "شريط الكليشة", A4WidthMm);

        if (b.LetterheadHeadMm is > 0 && b.LetterheadFootTopMm is > 0
            && b.LetterheadHeadMm >= b.LetterheadFootTopMm)
        {
            throw new ArgumentOutOfRangeException(
                nameof(b.LetterheadFootTopMm),
                "الهامش الأعلى يجب أن ينتهي قبل بداية الهامش الأسفل.");
        }

        if ((b.LetterheadPadMm ?? 0) + (b.LetterheadPadStartMm ?? 0) >= A4WidthMm)
        {
            throw new ArgumentOutOfRangeException(
                nameof(b.LetterheadPadMm),
                "مجموع الهامشين الأيمن والأيسر يجب أن يكون أقل من عرض الصفحة (210 مم).");
        }

        Image(b.LogoColorUrl, nameof(b.LogoColorUrl), "الشعار الملون", LogoMaxBytes);
        Image(b.LogoWhiteUrl, nameof(b.LogoWhiteUrl), "الشعار الأبيض", LogoMaxBytes);
        Image(b.StampUrl, nameof(b.StampUrl), "ختم المنشأة", StampMaxBytes);
        Image(b.SignatureUrl, nameof(b.SignatureUrl), "توقيع المقيم المعتمد", SignatureMaxBytes);
        Image(b.LetterheadUrl, nameof(b.LetterheadUrl), "كليشة التقرير", LetterheadMaxBytes);
        Image(b.HeaderUrl, nameof(b.HeaderUrl), "ترويسة التقرير", StampMaxBytes);
    }

    /// <summary>Returns the rejection message for one image value, or null when it is acceptable.</summary>
    public static string? ImageError(string? value, string label, int maxBytes)
    {
        var v = value?.Trim() ?? "";
        if (v.Length == 0) return null;
        if (v.StartsWith('/'))
            return v.StartsWith("//", StringComparison.Ordinal) ? $"{label}: المسار غير مسموح." : null;
        if (!v.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return $"{label}: يُقبل ملف صورة مرفوع فقط.";

        var comma = v.IndexOf(',');
        if (comma < 0) return $"{label}: ملف الصورة تالف.";
        var header = v[5..comma].ToLowerInvariant().Split(';');
        var mime = header[0];
        if (mime is not ("image/png" or "image/jpeg" or "image/svg+xml"))
            return $"{label}: الصيغ المسموحة PNG أو JPG أو SVG.";
        if (!header.Contains("base64"))
            return $"{label}: ملف الصورة تالف.";

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(v[(comma + 1)..]);
        }
        catch (FormatException)
        {
            return $"{label}: ملف الصورة تالف.";
        }

        if (bytes.Length > maxBytes)
            return $"{label}: حجم الملف يتجاوز {maxBytes / 1024} ك.ب.";

        return mime switch
        {
            "image/png" when !StartsWith(bytes, 0x89, 0x50, 0x4E, 0x47) =>
                $"{label}: محتوى الملف لا يطابق صيغة PNG.",
            "image/jpeg" when !StartsWith(bytes, 0xFF, 0xD8, 0xFF) =>
                $"{label}: محتوى الملف لا يطابق صيغة JPG.",
            "image/svg+xml" when UnsafeSvgPattern().IsMatch(Encoding.UTF8.GetString(bytes)) =>
                $"{label}: ملف SVG يحتوي على شيفرة أو روابط خارجية غير مسموحة.",
            _ => null,
        };
    }

    /// <summary>
    /// Audit snapshot of the settings with every inline image (brand assets and valuer
    /// signatures) replaced by its type, size and a short hash — the change stays traceable
    /// without copying megabytes into each audit row.
    /// </summary>
    public static object ForAudit(OrganizationSettingsDto dto)
    {
        var node = JsonSerializer.SerializeToNode(dto, JsonDefaults.Web);
        StripInlineImages(node);
        return node ?? new JsonObject();
    }

    public static string InlineImageFingerprint(string dataUrl)
    {
        var comma = dataUrl.IndexOf(',');
        var header = comma > 5 ? dataUrl[5..comma] : "unknown";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(dataUrl)))[..12]
            .ToLowerInvariant();
        return $"inline:{header};chars={dataUrl.Length};sha256={hash}";
    }

    private static void StripInlineImages(JsonNode? node)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var key in obj.Select(p => p.Key).ToList())
                {
                    if (obj[key] is JsonValue value
                        && value.TryGetValue<string>(out var text)
                        && text.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                    {
                        obj[key] = InlineImageFingerprint(text);
                    }
                    else
                    {
                        StripInlineImages(obj[key]);
                    }
                }
                break;
            case JsonArray array:
                foreach (var item in array) StripInlineImages(item);
                break;
        }
    }

    private static bool StartsWith(byte[] bytes, params byte[] signature) =>
        bytes.Length >= signature.Length && signature.Select((b, i) => bytes[i] == b).All(x => x);

    private static void Cm(decimal? value, string name, string label)
    {
        if (value is > 0 and (< 0.5m or > 20m))
            throw new ArgumentOutOfRangeException(name, $"{label} يجب أن يكون بين 0.5 و 20 سم.");
    }

    private static void Mm(decimal? value, string name, string label, decimal max)
    {
        if (value is null) return;
        if (value.Value < 0 || value.Value > max)
            throw new ArgumentOutOfRangeException(name, $"قيمة {label} خارج النطاق (0 – {max} مم).");
    }

    private static void Image(string? value, string name, string label, int maxBytes)
    {
        var error = ImageError(value, label, maxBytes);
        if (error is not null) throw new ArgumentOutOfRangeException(name, error);
    }
}
