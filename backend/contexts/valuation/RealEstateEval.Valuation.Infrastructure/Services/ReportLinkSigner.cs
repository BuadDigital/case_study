using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>Config section <c>ReportPdfLinks</c>.</summary>
public sealed class ReportPdfLinkOptions
{
 /// <summary>Days a public link stays valid. Regenerating the PDF issues a new link.</summary>
    public int LifetimeDays { get; set; } = ValuationReportPdfRules.DefaultLinkLifetimeDays;

 /// <summary>
 /// Optional dedicated secret. When empty the host's <c>Jwt:SigningKey</c> is reused
 /// (derived through a purpose HMAC, so the key never signs a token a JWT handler would accept).
 /// </summary>
    public string? Secret { get; set; }
}

/// <summary>
/// HMAC signer for <c>.pdf?k=…</c> links. Honors <c>Jwt:PreviousSigningKey</c> during key rotation
/// so links issued before the rotation keep working until they expire.
/// </summary>
public sealed class ReportLinkSigner : IReportLinkSigner
{
    private readonly string _current;
    private readonly IReadOnlyList<string> _verifyKeys;

    public ReportLinkSigner(IConfiguration configuration, IOptions<ReportPdfLinkOptions> options)
    {
        var opts = options.Value;
        var dedicated = (opts.Secret ?? "").Trim();
        var jwt = (configuration["Jwt:SigningKey"] ?? "").Trim();
        var previous = (configuration["Jwt:PreviousSigningKey"] ?? "").Trim();

        _current = dedicated.Length > 0 ? dedicated : jwt;
        if (_current.Length == 0)
        {
            throw new InvalidOperationException(
                "Report PDF links need ReportPdfLinks:Secret or Jwt:SigningKey to be configured.");
        }

        var keys = new List<string> { _current };
        if (dedicated.Length == 0 && previous.Length > 0) keys.Add(previous);
        _verifyKeys = keys;
        Lifetime = TimeSpan.FromDays(Math.Clamp(opts.LifetimeDays, 1, 3650));
    }

    public TimeSpan Lifetime { get; }

    public string Sign(Guid pdfId, string fileName, DateTimeOffset expiresAt) =>
        ReportLinkToken.Sign(_current, pdfId, fileName, expiresAt);

    public ReportLinkToken.Parsed? Verify(string? token, string fileName, DateTimeOffset now) =>
        ReportLinkToken.Verify(_verifyKeys, token, fileName, now);
}
