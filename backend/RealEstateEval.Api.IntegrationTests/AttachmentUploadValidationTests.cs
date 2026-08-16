using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// End-to-end shape of an upload rejection: the right status, an RFC 7807 body, and a
/// message that describes the rule that fired without echoing anything internal.
/// </summary>
public class AttachmentUploadValidationTests
    : IClassFixture<AttachmentsApiWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AttachmentUploadValidationTests(AttachmentsApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Upload_accepts_content_that_matches_its_declared_type()
    {
        var response = await PostAsync(new UploadAttachmentRequest
        {
            Scope = "property-registry",
            ScopeKey = "po-1",
            FileName = "deed.png",
            ContentType = "image/png",
            ContentBase64 = Convert.ToBase64String(Png()),
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Upload_rejects_a_script_payload_wearing_an_image_name()
    {
        var payload = Encoding.UTF8.GetBytes("<script>alert(document.cookie)</script>");

        var response = await PostAsync(new UploadAttachmentRequest
        {
            Scope = "property-registry",
            ScopeKey = "po-1",
            FileName = "harmless.png",
            ContentType = "image/png",
            ContentBase64 = Convert.ToBase64String(payload),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Upload_rejects_an_executable_renamed_to_pdf()
    {
        var payload = new byte[] { 0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00 };

        var response = await PostAsync(new UploadAttachmentRequest
        {
            Scope = "engineering-survey-report",
            ScopeKey = "po-1",
            FileName = "survey.pdf",
            ContentType = "application/pdf",
            ContentBase64 = Convert.ToBase64String(payload),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_rejection_body_is_problem_details_without_internal_detail()
    {
        var response = await PostAsync(new UploadAttachmentRequest
        {
            Scope = "property-registry",
            ScopeKey = "po-1",
            FileName = "deed.png",
            ContentType = "image/png",
            ContentBase64 = "this-is-not-base64!!!",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;

        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("title").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("detail").GetString()));

 // Legacy member kept so existing front-end callers reading `error` still work.
        Assert.Equal(
            root.GetProperty("detail").GetString(),
            root.GetProperty("error").GetString());

        Assert.DoesNotContain("Exception", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("   at ", body, StringComparison.Ordinal);
        Assert.DoesNotContain("RealEstateEval.", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task List_validation_failure_uses_the_same_problem_shape()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/attachments?scope=&scopeKey=");
        Authorize(request);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private async Task<HttpResponseMessage> PostAsync(UploadAttachmentRequest body)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/attachments")
        {
            Content = JsonContent.Create(body),
        };
        Authorize(request);
        return await _client.SendAsync(request);
    }

    private static void Authorize(HttpRequestMessage request) =>
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", TestAuthHandler.AttachmentsToken);

    private static byte[] Png()
    {
        var bytes = new byte[64];
        ReadOnlySpan<byte> signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        signature.CopyTo(bytes);
        return bytes;
    }
}
