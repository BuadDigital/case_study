using System.Security.Cryptography;
using System.Text;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>
/// Signed, expiring key for public report links: <c>k = {pdfId:N}.{expUnixSeconds}.{sig}</c>
/// where <c>sig</c> is base64url(HMAC-SHA256(derivedKey, "{pdfId:N}.{exp}.{fileName}")).
/// The derived key is HMAC-SHA256(secret, purpose) so the service's JWT signing key can be
/// reused without the token ever being a valid JWT. Pure and allocation-light; no clock inside.
/// </summary>
public static class ReportLinkToken
{
    public const string Purpose = "valuation-report-pdf-link:v1";

    public sealed record Parsed(Guid PdfId, DateTimeOffset ExpiresAt);

    public static string Sign(string secret, Guid pdfId, string fileName, DateTimeOffset expiresAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secret);
        var exp = expiresAt.ToUnixTimeSeconds();
        var sig = Signature(secret, pdfId, exp, fileName);
        return $"{pdfId:N}.{exp}.{sig}";
    }

 /// <summary>
 /// Verify structure, signature (constant time) and expiry. Returns null on any mismatch.
 /// <paramref name="secrets"/> lets a previous key stay valid during rotation.
 /// </summary>
    public static Parsed? Verify(
        IReadOnlyList<string> secrets,
        string? token,
        string fileName,
        DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 256) return null;
        var parts = token.Split('.');
        if (parts.Length != 3) return null;
        if (!Guid.TryParseExact(parts[0], "N", out var pdfId)) return null;
        if (!long.TryParse(parts[1], out var exp)) return null;
        // Out-of-range seconds would make FromUnixTimeSeconds throw; this runs on an anonymous
        // route, so a malformed key has to fall through to the caller's 404 like any other.
        if (exp < DateTimeOffset.MinValue.ToUnixTimeSeconds()
            || exp > DateTimeOffset.MaxValue.ToUnixTimeSeconds()) return null;
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(exp);
        if (expiresAt <= now) return null;

        var given = Encoding.ASCII.GetBytes(parts[2]);
        foreach (var secret in secrets)
        {
            if (string.IsNullOrWhiteSpace(secret)) continue;
            var expected = Encoding.ASCII.GetBytes(Signature(secret, pdfId, exp, fileName));
            if (CryptographicOperations.FixedTimeEquals(given, expected))
                return new Parsed(pdfId, expiresAt);
        }
        return null;
    }

    private static string Signature(string secret, Guid pdfId, long exp, string fileName)
    {
        var key = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(Purpose));
        var data = Encoding.UTF8.GetBytes($"{pdfId:N}.{exp}.{NormalizeFileName(fileName)}");
        return Base64Url(HMACSHA256.HashData(key, data));
    }

    private static string NormalizeFileName(string fileName) => (fileName ?? "").Trim().ToLowerInvariant();

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
