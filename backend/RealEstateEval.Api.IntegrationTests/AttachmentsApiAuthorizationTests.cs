extern alias AttachmentsApi;

using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Api.IntegrationTests;

public class AttachmentsApiAuthorizationTests
    : IClassFixture<AttachmentsApiWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AttachmentsApiAuthorizationTests(AttachmentsApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task List_requires_authentication()
    {
        var response = await _client.GetAsync("/api/attachments?scope=test&scopeKey=one");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task List_rejects_authenticated_user_without_attachment_capability()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/attachments?scope=test&scopeKey=one");
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                TestAuthHandler.AuthOnlyToken);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ForProperty_requires_authentication()
    {
        var response = await _client.GetAsync("/api/attachments/for-property?propertyId=prop-1");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Lookup_requires_authentication()
    {
        var response = await _client.GetAsync(
            $"/api/attachments/lookup?ids={SeededAttachmentLookup.OwnAttachmentId:D},{SeededAttachmentLookup.ForeignAttachmentId:D}");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ForProperty_hides_foreign_uploads_from_field_inspector()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/attachments/for-property?propertyId=prop-1");
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                TestAuthHandler.InspectorOwnerToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var rows = await DeserializeMetaListAsync(response);
        Assert.Single(rows);
        Assert.Equal(SeededAttachmentLookup.OwnAttachmentId, rows[0].Id);
    }

    [Fact]
    public async Task ForProperty_returns_empty_for_inspector_without_matching_uploads()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/attachments/for-property?propertyId=prop-1");
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                TestAuthHandler.InspectorStrangerToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var rows = await DeserializeMetaListAsync(response);
        Assert.Empty(rows);
    }

    [Fact]
    public async Task ForProperty_allows_inspector_to_read_their_own_foreign_scope_upload()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/attachments/for-property?propertyId=prop-1");
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                TestAuthHandler.InspectorOtherToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var rows = await DeserializeMetaListAsync(response);
        Assert.Single(rows);
        Assert.Equal(SeededAttachmentLookup.ForeignAttachmentId, rows[0].Id);
    }

    [Fact]
    public async Task ForProperty_allows_financial_capability_to_read_foreign_uploads()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/attachments/for-property?propertyId=prop-1");
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                TestAuthHandler.FinancialToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var rows = await DeserializeMetaListAsync(response);
        Assert.Equal(2, rows.Count);
    }

    [Fact]
    public async Task Lookup_hides_foreign_attachment_refs_from_field_inspector()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/attachments/lookup?ids={SeededAttachmentLookup.OwnAttachmentId:D},{SeededAttachmentLookup.ForeignAttachmentId:D}");
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                TestAuthHandler.InspectorOwnerToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var refs = await DeserializeRefListAsync(response);
        Assert.Single(refs);
        Assert.Equal(SeededAttachmentLookup.OwnAttachmentId, refs[0].Id);
    }

    [Fact]
    public async Task List_allows_user_with_attachment_capability()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/attachments?scope=test&scopeKey=one");
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                TestAuthHandler.AttachmentsToken);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<List<FileAttachmentMetaDto>> DeserializeMetaListAsync(HttpResponseMessage response)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        var rows = await JsonSerializer.DeserializeAsync<List<FileAttachmentMetaDto>>(
            stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        return rows ?? [];
    }

    private static async Task<List<AttachmentRefDto>> DeserializeRefListAsync(HttpResponseMessage response)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        var rows = await JsonSerializer.DeserializeAsync<List<AttachmentRefDto>>(
            stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        return rows ?? [];
    }
}

public sealed class AttachmentsApiWebApplicationFactory
    : WebApplicationFactory<AttachmentsApi::Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        BoundedContextConnections.ApplyDedicatedSettings(
            (key, value) => builder.UseSetting(key, value),
            "Host=localhost;Database=attachments_integration_test");
        builder.UseSetting(
            "Jwt:SigningKey",
            "integration-test-signing-key-that-is-at-least-sixty-four-characters-long-1234567890");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IAttachmentService>();
            services.AddSingleton<IAttachmentService, StubAttachmentService>();
            services.RemoveAll<IAttachmentLookup>();
            services.AddSingleton<IAttachmentLookup, SeededAttachmentLookup>();
            services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.TestScheme;
                    options.DefaultChallengeScheme = TestAuthHandler.TestScheme;
                })
                .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.TestScheme,
                    _ => { });
        });
    }
}

/// <summary>
/// Stands in for storage but runs the real upload gate, so HTTP-level tests exercise the
/// production validation rules rather than a hand-written approximation of them.
/// </summary>
internal sealed class StubAttachmentService : IAttachmentService
{
    public Task<IReadOnlyList<FileAttachmentMetaDto>> ListAsync(
        string scope,
        string scopeKey,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<FileAttachmentMetaDto>>([]);

    public Task<(byte[]? Content, FileAttachmentMetaDto? Meta)> GetContentAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
        => Task.FromResult<(byte[]?, FileAttachmentMetaDto?)>((null, null));

    public Task<(FileAttachmentMetaDto? Meta, string? Error)> UploadAsync(
        UploadAttachmentRequest request,
        string uploadedByUserId,
        CancellationToken cancellationToken = default)
    {
        byte[] content;
        try
        {
            content = Convert.FromBase64String(request.ContentBase64);
        }
        catch
        {
            return Task.FromResult<(FileAttachmentMetaDto?, string?)>((null, "invalid base64 content"));
        }

        var inspection = AttachmentUploadRules.Inspect(
            request.Scope,
            request.ContentType,
            request.FileName,
            content);
        if (inspection.Error is not null)
            return Task.FromResult<(FileAttachmentMetaDto?, string?)>((null, inspection.Error));

        return Task.FromResult<(FileAttachmentMetaDto?, string?)>((
            new FileAttachmentMetaDto
            {
                Id = Guid.NewGuid(),
                Scope = request.Scope,
                ScopeKey = request.ScopeKey,
                FileName = inspection.FileName,
                ContentType = inspection.ContentType,
                SizeBytes = content.LongLength,
                CreatedAtUtc = DateTime.UtcNow,
            },
            null));
    }

    public Task<FileAttachmentMetaDto?> GetMetaAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
        => Task.FromResult<FileAttachmentMetaDto?>(null);

    public Task<bool> DeleteAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
        => Task.FromResult(false);
}

internal sealed class SeededAttachmentLookup : IAttachmentLookup
{
    public static readonly Guid OwnAttachmentId =
        Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid ForeignAttachmentId =
        Guid.Parse("22222222-2222-2222-2222-222222222222");

    private readonly List<AttachmentRow> _rows =
    [
        new(
            OwnAttachmentId,
            "field-inspection-photo",
            "prop-1",
            "owner-photo.jpg",
            "owner-1"),
        new(
            ForeignAttachmentId,
            "field-inspection-photo",
            "prop-1:slot",
            "other-photo.jpg",
            "other"),
    ];

    public Task<bool> ExistsAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var row = _rows.FirstOrDefault(r => r.Id == id);
        if (row is null)
            return Task.FromResult(false);
        return Task.FromResult(actor is null || AttachmentAccessRules.Allows(row.UploadedByUserId, actor));
    }

    public Task<IReadOnlyList<AttachmentRefDto>> GetRefsAsync(
        IReadOnlyList<Guid> ids,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var rows = _rows
            .Where(r => ids.Contains(r.Id))
            .Where(r => actor is null || AttachmentAccessRules.Allows(r.UploadedByUserId, actor))
            .Select(r => new AttachmentRefDto
            {
                Id = r.Id,
                Scope = r.Scope,
                ScopeKey = r.ScopeKey,
            })
            .ToList();
        return Task.FromResult<IReadOnlyList<AttachmentRefDto>>(rows);
    }

    public Task<IReadOnlyList<FileAttachmentMetaDto>> ListForPropertyAsync(
        string propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var needle = propertyId.Trim();
        var rows = _rows
            .Where(r => AttachmentAccessRules.ScopeKeyMatchesProperty(r.ScopeKey, needle))
            .Where(r => actor is null || AttachmentAccessRules.Allows(r.UploadedByUserId, actor))
            .Select(r => new FileAttachmentMetaDto
            {
                Id = r.Id,
                Scope = r.Scope,
                ScopeKey = r.ScopeKey,
                FileName = r.FileName,
                ContentType = "image/jpeg",
                SizeBytes = 4,
                CreatedAtUtc = DateTime.UtcNow,
            })
            .ToList();
        return Task.FromResult<IReadOnlyList<FileAttachmentMetaDto>>(rows);
    }

    private sealed record AttachmentRow(
        Guid Id,
        string Scope,
        string ScopeKey,
        string FileName,
        string UploadedByUserId);
}

internal sealed class StubAttachmentLookup : IAttachmentLookup
{
    public Task<bool> ExistsAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
        => Task.FromResult(false);

    public Task<IReadOnlyList<AttachmentRefDto>> GetRefsAsync(
        IReadOnlyList<Guid> ids,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<AttachmentRefDto>>([]);

    public Task<IReadOnlyList<FileAttachmentMetaDto>> ListForPropertyAsync(
        string propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<FileAttachmentMetaDto>>([]);
}
