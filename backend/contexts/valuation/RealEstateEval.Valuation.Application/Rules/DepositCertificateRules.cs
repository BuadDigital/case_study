using System.Text;
using System.Text.RegularExpressions;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// The Qeema deposit certificate recorded with the deposit code: a one-page PDF, mandatory. A corrective
/// re-registration after the final issuance may send the code alone — the certificate already on the copy stays.
/// </summary>
public static partial class DepositCertificateRules
{
    public const int MaxBytes = 10 * 1024 * 1024;

    public const string RequiredAr = "أرفق شهادة الإيداع (PDF)";
    public const string InvalidBase64Ar = "محتوى الشهادة غير صالح (Base64)";
    public const string NotPdfAr = "شهادة الإيداع ملف PDF";
    public const string TooLargeAr = "حجم شهادة الإيداع أكبر من المسموح (10 م.ب)";
    public const string OnePageAr = "شهادة الإيداع صفحة واحدة";

    private const string ErrorKey = "certificateContentBase64";

    /// <summary>
    /// Reads and validates the posted certificate. Null bytes with no error means the copy already holds one
    /// and the request sent none (a code-only correction).
    /// </summary>
    public static (byte[]? Content, Dictionary<string, string>? Errors) Read(
        string? contentBase64,
        string? contentType,
        string? fileName,
        bool alreadyHasCertificate)
    {
        if (string.IsNullOrWhiteSpace(contentBase64))
            return alreadyHasCertificate ? (null, null) : (null, Error(RequiredAr));

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(contentBase64);
        }
        catch (FormatException)
        {
            return (null, Error(InvalidBase64Ar));
        }

        var error = Validate(bytes, contentType, fileName);
        return error is null ? (bytes, null) : (null, Error(error));
    }

    /// <summary>The Arabic refusal for an unusable certificate, or null.</summary>
    public static string? Validate(byte[] bytes, string? contentType, string? fileName)
    {
        if (bytes.Length == 0) return RequiredAr;
        if (bytes.Length > MaxBytes) return TooLargeAr;

        // A PDF starts with «%PDF-»; the declared type / extension alone prove nothing.
        var isPdf = bytes.Length >= 5 && Encoding.ASCII.GetString(bytes, 0, 5) == "%PDF-";
        if (!isPdf) return NotPdfAr;

        return PageCount(bytes) > 1 ? OnePageAr : null;
    }

    /// <summary>
    /// Page objects counted from the raw bytes. A PDF that hides its page tree in compressed object streams
    /// reads as zero pages — unknown, never refused: only a provable second page is rejected.
    /// </summary>
    public static int PageCount(byte[] bytes) =>
        PageObject().Matches(Encoding.Latin1.GetString(bytes)).Count;

    [GeneratedRegex(@"/Type\s*/Page(?![A-Za-z])")]
    private static partial Regex PageObject();

    private static Dictionary<string, string> Error(string message) => new() { [ErrorKey] = message };
}
