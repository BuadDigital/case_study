extern alias AttachmentsApi;
extern alias CaseStudyApi;
extern alias FailuresApi;
extern alias FinancialApi;
extern alias IdentityApi;
extern alias OperationsApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;

using AttachmentsMarker = AttachmentsApi::RealEstateEval.Attachments.Api.Controllers.AttachmentsController;
using CaseStudyMarker = CaseStudyApi::RealEstateEval.CaseStudy.Api.Controllers.WorkflowTasksController;
using FailuresMarker = FailuresApi::RealEstateEval.Failures.Api.Controllers.FailuresController;
using FinancialMarker = FinancialApi::Program;
using IdentityMarker = IdentityApi::RealEstateEval.Identity.Api.Controllers.AuthController;
using OperationsMarker = OperationsApi::RealEstateEval.Operations.Api.Controllers.PropertyKeysController;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// HTTP-level tests that deliberately pass authorization and execute controller actions and
/// production persistence services against a migrated Postgres database.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ControllerBodyPostgresTests : IAsyncLifetime
{
    private readonly PostgresFixture _postgres;
    private string _connectionString = "";

    public ControllerBodyPostgresTests(PostgresFixture postgres) => _postgres = postgres;

    public async Task InitializeAsync()
    {
        if (!DockerEnvironment.IsAvailable)
            return;

        _connectionString = await _postgres.EnsureDatabaseAsync("controller_bodies");
        await using var db = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(_connectionString)
                .Options);
        await db.Database.MigrateAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [DockerFact]
    public async Task Auth_login_refresh_and_activate_execute_against_postgres()
    {
        using var factory = Factory<IdentityMarker>("Identity");
        using var client = factory.CreateClient();

        var login = await client.PostAsJsonAsync("/api/auth/login", new PasswordLoginRequest
        {
            Username = "missing-user",
            Password = "not-the-password",
        });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);

        var refresh = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshTokenRequest
        {
            RefreshToken = "invalid-refresh-token",
        });
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);

        var activate = await client.PostAsJsonAsync("/api/auth/activate", new ActivateAccountRequest
        {
            UserName = "missing-user",
            Token = "invalid-activation-ticket",
            NewPassword = "A-valid-looking-password-123!",
        });
        Assert.Equal(HttpStatusCode.BadRequest, activate.StatusCode);
    }

    [DockerFact]
    public async Task Attachment_upload_validation_executes_with_postgres_configured()
    {
        using var factory = Factory<AttachmentsMarker>("Attachments");
        using var client = factory.CreateClient();
        using var request = AuthorizedPost("/api/attachments", new UploadAttachmentRequest
        {
            Scope = "property-registry",
            ScopeKey = "po-container",
            FileName = "deed.png",
            ContentType = "image/png",
            ContentBase64 = Convert.ToBase64String(
                Encoding.UTF8.GetBytes("<script>not an image</script>")),
        });

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [DockerFact]
    public async Task Financial_summary_executes_through_canonical_and_v1_alias_routes()
    {
        using var factory = Factory<FinancialMarker>("Financial");
        using var client = factory.CreateClient();

        using var canonicalRequest = AuthorizedGet("/api/financial/summary");
        var canonical = await client.SendAsync(canonicalRequest);
        Assert.Equal(HttpStatusCode.OK, canonical.StatusCode);

        using var aliasRequest = AuthorizedGet("/api/financial/v1/summary");
        var alias = await client.SendAsync(aliasRequest);
        Assert.Equal(HttpStatusCode.OK, alias.StatusCode);
        Assert.Equal(
            await canonical.Content.ReadAsStringAsync(),
            await alias.Content.ReadAsStringAsync());
    }

    [DockerFact]
    public async Task Key_envelope_and_property_key_lists_execute_against_postgres()
    {
        using var factory = Factory<OperationsMarker>("Operations");
        using var client = factory.CreateClient();

        using var propertyKeysRequest = AuthorizedGet("/api/property-keys");
        var propertyKeys = await client.SendAsync(propertyKeysRequest);
        Assert.Equal(HttpStatusCode.OK, propertyKeys.StatusCode);

        using var envelopesRequest = AuthorizedGet("/api/key-envelopes");
        var envelopes = await client.SendAsync(envelopesRequest);
        Assert.Equal(HttpStatusCode.OK, envelopes.StatusCode);
    }

    [DockerFact]
    public async Task Failures_list_executes_against_postgres()
    {
        using var factory = Factory<FailuresMarker>("Failures");
        using var client = factory.CreateClient();
        using var request = AuthorizedGet("/api/failures");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [DockerFact]
    public async Task Workflow_and_operations_task_lists_execute_against_postgres()
    {
        using var factory = Factory<CaseStudyMarker>("CaseStudy");
        using var client = factory.CreateClient();

        using var workflowRequest = AuthorizedGet("/api/workflow-tasks");
        var workflow = await client.SendAsync(workflowRequest);
        Assert.Equal(HttpStatusCode.OK, workflow.StatusCode);

        using var operationsRequest = AuthorizedGet("/api/operations-tasks");
        var operations = await client.SendAsync(operationsRequest);
        Assert.Equal(HttpStatusCode.OK, operations.StatusCode);
    }

    [DockerFact]
    public async Task Case_study_work_order_list_and_ops_create_validation_execute()
    {
        using var factory = Factory<CaseStudyMarker>("CaseStudy");
        using var client = factory.CreateClient();

        using var listRequest = AuthorizedGet("/api/work-orders?page=1&pageSize=20");
        var list = await client.SendAsync(listRequest);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);

        using var createRequest = AuthorizedPost("/api/operations-tasks", new CreateOperationsTaskRequest());
        var create = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal("application/problem+json", create.Content.Headers.ContentType?.MediaType);
    }

    [DockerFact]
    public async Task Operations_create_key_envelope_validation_executes()
    {
        using var factory = Factory<OperationsMarker>("Operations");
        using var client = factory.CreateClient();

        using var createRequest = AuthorizedPost("/api/key-envelopes", new CreateKeyEnvelopeRequest
        {
            RequestNumber = "",
            Court = "",
            Circuit = "",
            ReceiveScenario = "not-a-scenario",
        });
        var create = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal("application/problem+json", create.Content.Headers.ContentType?.MediaType);
    }

    [DockerFact]
    public async Task Failures_create_validation_executes()
    {
        using var factory = Factory<FailuresMarker>("Failures");
        using var client = factory.CreateClient();

        using var createRequest = AuthorizedPost("/api/failures", new CreateFailureRequest());
        var create = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal("application/problem+json", create.Content.Headers.ContentType?.MediaType);
    }

    private RealDatabaseApiFactory<TMarker> Factory<TMarker>(string serviceName)
        where TMarker : class =>
        new(_connectionString, serviceName);

    private static HttpRequestMessage AuthorizedGet(string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        Authorize(request);
        return request;
    }

    private static HttpRequestMessage AuthorizedPost<TBody>(string path, TBody body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body),
        };
        Authorize(request);
        return request;
    }

    private static void Authorize(HttpRequestMessage request) =>
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", ContainerAuthHandler.Token);
}

internal sealed class RealDatabaseApiFactory<TMarker> : WebApplicationFactory<TMarker>
    where TMarker : class
{
    private const string TestSigningKey =
        "container-test-signing-key-that-is-at-least-sixty-four-characters-long-1234567890";

    private readonly string _connectionString;
    private readonly string _serviceName;

    public RealDatabaseApiFactory(string connectionString, string serviceName)
    {
        _connectionString = connectionString;
        _serviceName = serviceName;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting($"ConnectionStrings:{_serviceName}", _connectionString);
        builder.UseSetting("Jwt:SigningKey", TestSigningKey);
        builder.UseSetting("Redis:Enabled", "false");
        builder.UseSetting("RabbitMQ:Enabled", "false");
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.UseSetting("Database:SeedDemoData", "false");
        builder.UseSetting(
            "BlobStorage:LocalRootPath",
            Path.Combine(Path.GetTempPath(), "real-estate-eval-container-tests"));

        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = ContainerAuthHandler.SchemeName;
                    options.DefaultChallengeScheme = ContainerAuthHandler.SchemeName;
                })
                .AddScheme<AuthenticationSchemeOptions, ContainerAuthHandler>(
                    ContainerAuthHandler.SchemeName,
                    _ => { });
        });
    }
}

internal sealed class ContainerAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "ContainerTest";
    public const string Token = "controller-body-token";

    public ContainerAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (Request.Headers.Authorization != $"Bearer {Token}")
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "container-test-user"),
            new(ClaimTypes.Name, "Container Test User"),
            new(PlatformCapabilities.ClaimType, PlatformCapabilities.Authenticated),
        };
        claims.AddRange(PlatformCapabilities.All.Select(
            capability => new Claim(PlatformCapabilities.ClaimType, capability)));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
