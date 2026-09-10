using System.Text;
using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Rules;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class OrganizationBrandingRulesTests
{
    private static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0];

    private static string DataUrl(string mime, byte[] bytes) =>
        $"data:{mime};base64,{Convert.ToBase64String(bytes)}";

    [Fact]
    public void Accepts_defaults_asset_paths_and_real_images()
    {
        OrganizationBrandingRules.Validate(new OrganizationBrandingSettingsDto
        {
            LetterheadUrl = "/case-study/ejadah-letterhead.png",
            SignatureUrl = DataUrl("image/png", PngHeader),
            LogoWhiteUrl = DataUrl("image/svg+xml", Encoding.UTF8.GetBytes("<svg><path d=\"M0 0\"/></svg>")),
            LetterheadHeadMm = 41,
            LetterheadFootTopMm = 270,
            LetterheadPadMm = 17,
            LetterheadPadStartMm = 13,
        });
    }

    [Fact]
    public void Top_margin_must_end_before_the_bottom_margin_starts()
    {
        var ex = Assert.Throws<ArgumentOutOfRangeException>(() =>
            OrganizationBrandingRules.Validate(new OrganizationBrandingSettingsDto
            {
                LetterheadHeadMm = 200,
                LetterheadFootTopMm = 150,
            }));

        Assert.Contains("الهامش الأعلى", ex.Message);
    }

    [Fact]
    public void Side_margins_must_leave_room_for_content()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            OrganizationBrandingRules.Validate(new OrganizationBrandingSettingsDto
            {
                LetterheadPadMm = 110,
                LetterheadPadStartMm = 100,
            }));
    }

    [Theory]
    [InlineData("<svg><script>alert(1)</script></svg>")]
    [InlineData("<svg onload=\"x()\"></svg>")]
    [InlineData("<svg><image href=\"https://evil.example/x.png\"/></svg>")]
    [InlineData("<svg><foreignObject></foreignObject></svg>")]
    public void Rejects_svg_with_script_or_external_references(string svg)
    {
        var error = OrganizationBrandingRules.ImageError(
            DataUrl("image/svg+xml", Encoding.UTF8.GetBytes(svg)), "الشعار", 1024 * 1024);

        Assert.NotNull(error);
    }

    [Fact]
    public void Rejects_other_formats_mismatched_bytes_oversize_and_external_urls()
    {
        Assert.NotNull(OrganizationBrandingRules.ImageError(DataUrl("image/gif", PngHeader), "x", 1024));
        Assert.NotNull(OrganizationBrandingRules.ImageError(DataUrl("image/png", [1, 2, 3, 4]), "x", 1024));
        Assert.NotNull(OrganizationBrandingRules.ImageError(DataUrl("image/png", PngHeader), "x", 4));
        Assert.NotNull(OrganizationBrandingRules.ImageError("https://cdn.example/logo.png", "x", 1024));
        Assert.NotNull(OrganizationBrandingRules.ImageError("//cdn.example/logo.png", "x", 1024));
        Assert.Null(OrganizationBrandingRules.ImageError("", "x", 1024));
    }

    [Fact]
    public void Audit_snapshot_keeps_a_fingerprint_instead_of_the_image_bytes()
    {
        var image = DataUrl("image/png", PngHeader);
        var dto = new OrganizationSettingsDto
        {
            Branding = new OrganizationBrandingSettingsDto { SignatureUrl = image },
            Valuers =
            [
                new OrganizationValuerRosterEntryDto { NameAr = "مقيم", SignatureUrl = image },
            ],
        };

        var json = JsonSerializer.Serialize(OrganizationBrandingRules.ForAudit(dto));

        Assert.DoesNotContain("base64,", json);
        Assert.Contains(OrganizationBrandingRules.InlineImageFingerprint(image), json);
    }
}
