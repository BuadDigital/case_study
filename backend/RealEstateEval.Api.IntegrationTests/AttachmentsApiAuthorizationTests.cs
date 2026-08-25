extern alias AttachmentsApi;

using System.Net;
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
        var response = await _client.GetAsync($"/api/attachments/lookup?ids={Guid.NewGuid():D}");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ForProperty_allows_authenticated_user()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/attachments/for-property?propertyId=prop-1");
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                TestAuthHandler.AuthOnlyToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
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
            services.AddSingleton<IAttachmentLookup, StubAttachmentLookup>();
            services.RemoveAll<IPermissionService>();
            services.AddSingleton<IPermissionService, StubPermissionService>();
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

internal sealed class StubPermissionService : IPermissionService
{
    public Task<PermissionsDto?> GetForUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default)
        => Task.FromResult<PermissionsDto?>(new PermissionsDto
        {
            UserId = userId,
            PrototypeRole = "case-specialist",
        });
}
