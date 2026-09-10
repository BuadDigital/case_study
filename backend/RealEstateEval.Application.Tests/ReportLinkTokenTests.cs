using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ReportLinkTokenTests
{
    private const string Secret = "unit-test-secret-that-is-long-enough-for-hmac-0123456789";
    private static readonly DateTimeOffset Now = new(2026, 9, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Sign_then_verify_roundtrips_id_and_expiry()
    {
        var id = Guid.NewGuid();
        var exp = Now.AddDays(30);
        var token = ReportLinkToken.Sign(Secret, id, "051421.pdf", exp);

        var parsed = ReportLinkToken.Verify([Secret], token, "051421.pdf", Now);

        Assert.NotNull(parsed);
        Assert.Equal(id, parsed.PdfId);
        Assert.Equal(exp.ToUnixTimeSeconds(), parsed.ExpiresAt.ToUnixTimeSeconds());
        Assert.DoesNotContain("+", token);
        Assert.DoesNotContain("/", token);
        Assert.DoesNotContain("=", token);
    }

    [Fact]
    public void File_name_comparison_is_case_insensitive_but_bound()
    {
        var token = ReportLinkToken.Sign(Secret, Guid.NewGuid(), "VR-12.pdf", Now.AddDays(1));

        Assert.NotNull(ReportLinkToken.Verify([Secret], token, "vr-12.pdf", Now));
        Assert.Null(ReportLinkToken.Verify([Secret], token, "vr-13.pdf", Now));
    }

    [Fact]
    public void Expired_token_is_rejected()
    {
        var token = ReportLinkToken.Sign(Secret, Guid.NewGuid(), "a.pdf", Now.AddSeconds(10));

        Assert.NotNull(ReportLinkToken.Verify([Secret], token, "a.pdf", Now));
        Assert.Null(ReportLinkToken.Verify([Secret], token, "a.pdf", Now.AddSeconds(11)));
    }

    [Fact]
    public void Tampered_signature_or_expiry_is_rejected()
    {
        var id = Guid.NewGuid();
        var token = ReportLinkToken.Sign(Secret, id, "a.pdf", Now.AddDays(1));
        var parts = token.Split('.');

        var laterExpiry = $"{parts[0]}.{Now.AddDays(400).ToUnixTimeSeconds()}.{parts[2]}";
        Assert.Null(ReportLinkToken.Verify([Secret], laterExpiry, "a.pdf", Now));

        var flipped = parts[2][0] == 'A' ? 'B' : 'A';
        var badSig = $"{parts[0]}.{parts[1]}.{flipped}{parts[2][1..]}";
        Assert.Null(ReportLinkToken.Verify([Secret], badSig, "a.pdf", Now));

        var otherId = $"{Guid.NewGuid():N}.{parts[1]}.{parts[2]}";
        Assert.Null(ReportLinkToken.Verify([Secret], otherId, "a.pdf", Now));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("a.b")]
    [InlineData("not-a-guid.123.sig")]
    [InlineData("00000000000000000000000000000000.notanumber.sig")]
    // Seconds outside DateTimeOffset's range must fall through as "no" — the public link route
    // is anonymous, so a throw here would answer 500 instead of the intended 404.
    [InlineData("00000000000000000000000000000000.99999999999999.sig")]
    [InlineData("00000000000000000000000000000000.-99999999999999.sig")]
    [InlineData("00000000000000000000000000000000.9223372036854775807.sig")]
    public void Malformed_tokens_are_rejected(string? token) =>
        Assert.Null(ReportLinkToken.Verify([Secret], token, "a.pdf", Now));

    [Fact]
    public void Previous_secret_keeps_old_links_valid_during_rotation()
    {
        var token = ReportLinkToken.Sign("old-secret-0123456789-0123456789", Guid.NewGuid(), "a.pdf", Now.AddDays(1));

        Assert.Null(ReportLinkToken.Verify(["new-secret-0123456789-0123456789"], token, "a.pdf", Now));
        Assert.NotNull(ReportLinkToken.Verify(
            ["new-secret-0123456789-0123456789", "old-secret-0123456789-0123456789"],
            token,
            "a.pdf",
            Now));
    }

    [Fact]
    public void Oversized_token_is_rejected_before_parsing() =>
        Assert.Null(ReportLinkToken.Verify([Secret], new string('a', 300), "a.pdf", Now));
}

public class ValuationReportPdfRulesTests
{
    [Theory]
    [InlineData("051421", "VR-1", "051421.pdf")]
    [InlineData("051421,617499,660002182618", "VR-1", "051421,617499,660002182618.pdf")]
    [InlineData("  VR-453 / 2026  ", "VR-1", "VR-453-2026.pdf")]
    [InlineData("تقرير ٤٥٣", "VR-7", "VR-7.pdf")]
    [InlineData("", "VR-7", "VR-7.pdf")]
    [InlineData(null, null, "valuation-report.pdf")]
    [InlineData("../../etc/passwd", "x", "etc-passwd.pdf")]
    public void File_name_is_url_safe_ascii_from_report_number(
        string? reportNumber,
        string? displayId,
        string expected) =>
        Assert.Equal(expected, ValuationReportPdfRules.BuildFileName(reportNumber, displayId));

    [Fact]
    public void File_name_is_capped()
    {
        var name = ValuationReportPdfRules.BuildFileName(new string('9', 500), "x");
        Assert.EndsWith(".pdf", name);
        Assert.True(name.Length <= 100, name.Length.ToString());
    }
}
