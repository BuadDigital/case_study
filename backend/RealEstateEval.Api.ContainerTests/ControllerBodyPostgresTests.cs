extern alias AttachmentsApi;
extern alias CaseStudyApi;
extern alias FailuresApi;
extern alias FinancialApi;
extern alias IdentityApi;
extern alias OperationsApi;
extern alias PlatformApi;
extern alias ReportingApi;
extern alias ValuationApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

using AttachmentsMarker = AttachmentsApi::RealEstateEval.Attachments.Api.Controllers.AttachmentsController;
using CaseStudyMarker = CaseStudyApi::RealEstateEval.CaseStudy.Api.Controllers.WorkflowTasksController;
using FailuresMarker = FailuresApi::RealEstateEval.Failures.Api.Controllers.FailuresController;
using FinancialMarker = FinancialApi::Program;
using IdentityMarker = IdentityApi::RealEstateEval.Identity.Api.Controllers.AuthController;
using OperationsMarker = OperationsApi::RealEstateEval.Operations.Api.Controllers.PropertyKeysController;
using PlatformMarker = PlatformApi::RealEstateEval.Platform.Api.Controllers.OrganizationSettingsController;
using ReportingMarker = ReportingApi::RealEstateEval.Reporting.Api.Controllers.ReportingController;
using ValuationMarker = ValuationApi::RealEstateEval.Valuation.Api.Controllers.ValuationRequestsController;
using IReportingUpstreamClient = ReportingApi::RealEstateEval.Reporting.Api.Services.IReportingUpstreamClient;

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
        // A10: the nine context streams alone provision the schema.
        await BoundedContextStreamMigrator.ApplyAllStreamsAsync(_connectionString);
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
    public async Task Workflow_task_list_executes_against_postgres()
    {
        using var factory = Factory<CaseStudyMarker>("CaseStudy");
        using var client = factory.CreateClient();

        using var workflowRequest = AuthorizedGet("/api/workflow-tasks");
        var workflow = await client.SendAsync(workflowRequest);
        Assert.Equal(HttpStatusCode.OK, workflow.StatusCode);
    }

    [DockerFact]
    public async Task Operations_task_list_executes_against_postgres()
    {
        using var factory = Factory<OperationsMarker>("Operations");
        using var client = factory.CreateClient();

        using var operationsRequest = AuthorizedGet("/api/operations-tasks");
        var operations = await client.SendAsync(operationsRequest);
        Assert.Equal(HttpStatusCode.OK, operations.StatusCode);
    }

    [DockerFact]
    public async Task Case_study_work_order_list_executes_against_postgres()
    {
        using var factory = Factory<CaseStudyMarker>("CaseStudy");
        using var client = factory.CreateClient();

        using var listRequest = AuthorizedGet("/api/work-orders?page=1&pageSize=20");
        var list = await client.SendAsync(listRequest);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
    }

    [DockerFact]
    public async Task Operations_create_task_validation_executes()
    {
        using var factory = Factory<OperationsMarker>("Operations");
        using var client = factory.CreateClient();

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

    [DockerFact]
    public async Task Clients_list_and_create_validation_execute_against_postgres()
    {
        using var factory = Factory<CaseStudyMarker>("CaseStudy");
        using var client = factory.CreateClient();

        using var listRequest = AuthorizedGet("/api/clients");
        var list = await client.SendAsync(listRequest);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var clients = await list.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(clients);
        Assert.True(clients!.Length >= 2, "Seed clients Infath and Nabr should exist after list.");

        using var missing = AuthorizedGet($"/api/clients/{Guid.NewGuid():D}");
        var missingResponse = await client.SendAsync(missing);
        Assert.Equal(HttpStatusCode.NotFound, missingResponse.StatusCode);

        using var createRequest = AuthorizedPost("/api/clients", new { nameAr = "" });
        var create = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal("application/problem+json", create.Content.Headers.ContentType?.MediaType);
    }

    [DockerFact]
    public async Task Po_intake_draft_save_get_and_delete_roundtrip()
    {
        using var factory = Factory<CaseStudyMarker>("CaseStudy");
        using var client = factory.CreateClient();

        using var missingRequest = AuthorizedGet("/api/po-intake-draft/mine");
        var missing = await client.SendAsync(missingRequest);
        Assert.Equal(HttpStatusCode.OK, missing.StatusCode);
        var missingBody = await missing.Content.ReadFromJsonAsync<PoIntakeDraftDto>();
        Assert.Equal("", missingBody?.PoNumber);
        Assert.Null(missingBody?.UpdatedAtUtc);

        using var saveRequest = AuthorizedPut(
            "/api/po-intake-draft",
            new PoIntakeDraftDto { Step = 2, PoNumber = "PO-F6", ExpectedPropertyCount = 3 });
        var saved = await client.SendAsync(saveRequest);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var savedBody = await saved.Content.ReadFromJsonAsync<PoIntakeDraftDto>();
        Assert.Equal("PO-F6", savedBody?.PoNumber);
        Assert.Equal(2, savedBody?.Step);

        using var getRequest = AuthorizedGet("/api/po-intake-draft/mine");
        var got = await client.SendAsync(getRequest);
        Assert.Equal(HttpStatusCode.OK, got.StatusCode);
        var gotBody = await got.Content.ReadFromJsonAsync<PoIntakeDraftDto>();
        Assert.Equal("PO-F6", gotBody?.PoNumber);

        using var deleteRequest = AuthorizedDelete("/api/po-intake-draft/mine");
        var deleted = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        using var afterDeleteRequest = AuthorizedGet("/api/po-intake-draft/mine");
        var afterDelete = await client.SendAsync(afterDeleteRequest);
        Assert.Equal(HttpStatusCode.OK, afterDelete.StatusCode);
        var afterDeleteBody = await afterDelete.Content.ReadFromJsonAsync<PoIntakeDraftDto>();
        Assert.Equal("", afterDeleteBody?.PoNumber);
        Assert.Null(afterDeleteBody?.UpdatedAtUtc);
    }

    [DockerFact]
    public async Task Work_order_unknown_po_and_create_validation_execute()
    {
        using var factory = Factory<CaseStudyMarker>("CaseStudy");
        using var client = factory.CreateClient();

        using var missingRequest = AuthorizedGet("/api/work-orders/PO-F6-MISSING");
        var missing = await client.SendAsync(missingRequest);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        using var rowsRequest = AuthorizedGet("/api/work-orders/property-rows");
        var rows = await client.SendAsync(rowsRequest);
        Assert.Equal(HttpStatusCode.OK, rows.StatusCode);

        using var createRequest = AuthorizedPost("/api/work-orders", new CreateWorkOrderRequest());
        var create = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal("application/problem+json", create.Content.Headers.ContentType?.MediaType);
    }

    [DockerFact]
    public async Task Financial_inspector_fee_summary_and_unknown_task_execute()
    {
        using var factory = Factory<FinancialMarker>("Financial");
        using var client = factory.CreateClient();

        using var summaryRequest = AuthorizedGet("/api/financial-dispatch/inspector-fees");
        var summary = await client.SendAsync(summaryRequest);
        Assert.Equal(HttpStatusCode.OK, summary.StatusCode);

        using var missingRequest = AuthorizedGet(
            $"/api/financial-dispatch/inspector-fees/{Guid.NewGuid():D}");
        var missing = await client.SendAsync(missingRequest);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [DockerFact]
    public async Task Platform_settings_catalogs_and_court_validation_execute()
    {
        using var factory = Factory<PlatformMarker>("Platform");
        using var client = factory.CreateClient();

        using var settingsRequest = AuthorizedGet("/api/organization-settings");
        var settings = await client.SendAsync(settingsRequest);
        Assert.Equal(HttpStatusCode.OK, settings.StatusCode);

        using var dictionaryRequest = AuthorizedGet("/api/field-dictionary");
        var dictionary = await client.SendAsync(dictionaryRequest);
        Assert.Equal(HttpStatusCode.OK, dictionary.StatusCode);

        using var factorsRequest = AuthorizedGet("/api/difference-factor-catalog");
        var factors = await client.SendAsync(factorsRequest);
        Assert.Equal(HttpStatusCode.OK, factors.StatusCode);

        using var rolesRequest = AuthorizedGet("/api/case-study-info-roles");
        var roles = await client.SendAsync(rolesRequest);
        Assert.Equal(HttpStatusCode.OK, roles.StatusCode);

        using var printRequest = AuthorizedGet("/api/attachment-print-dictionary");
        var print = await client.SendAsync(printRequest);
        Assert.Equal(HttpStatusCode.OK, print.StatusCode);

        using var auditRequest = AuthorizedGet("/api/audit-log?page=1&limit=20");
        var audit = await client.SendAsync(auditRequest);
        Assert.Equal(HttpStatusCode.OK, audit.StatusCode);

        using var courtsRequest = AuthorizedGet("/api/courts");
        var courts = await client.SendAsync(courtsRequest);
        Assert.Equal(HttpStatusCode.OK, courts.StatusCode);

        using var createRequest = AuthorizedPost(
            "/api/admin/courts",
            new { name = "", region = "", city = "" });
        var create = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal("application/problem+json", create.Content.Headers.ContentType?.MediaType);
    }

    [DockerFact]
    public async Task Platform_notifications_create_list_and_delete_roundtrip()
    {
        using var factory = Factory<PlatformMarker>("Platform");
        using var client = factory.CreateClient();

        using var emptyTitleRequest = AuthorizedPost(
            "/api/notifications",
            new CreateUserNotificationRequest { Title = "" });
        var emptyTitle = await client.SendAsync(emptyTitleRequest);
        Assert.Equal(HttpStatusCode.BadRequest, emptyTitle.StatusCode);

        using var createRequest = AuthorizedPost(
            "/api/notifications",
            new CreateUserNotificationRequest { Title = "F6 notice", Body = "postgres body" });
        var created = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var createdBody = await created.Content.ReadFromJsonAsync<UserNotificationDto>();
        Assert.Equal("F6 notice", createdBody?.Title);
        Assert.NotEqual(Guid.Empty, createdBody?.Id);

        using var listRequest = AuthorizedGet("/api/notifications");
        var list = await client.SendAsync(listRequest);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var rows = await list.Content.ReadFromJsonAsync<UserNotificationDto[]>();
        Assert.Contains(rows ?? [], row => row.Id == createdBody!.Id);

        using var missingDelete = AuthorizedDelete($"/api/notifications/{Guid.NewGuid():D}");
        var missing = await client.SendAsync(missingDelete);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        using var deleteRequest = AuthorizedDelete($"/api/notifications/{createdBody!.Id:D}");
        var deleted = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
    }

    [DockerFact]
    public async Task Valuation_queue_comparables_and_recalls_execute()
    {
        using var factory = Factory<ValuationMarker>("Valuation");
        using var client = factory.CreateClient();

        using var listRequest = AuthorizedGet("/api/valuation-requests");
        var list = await client.SendAsync(listRequest);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);

        using var missingRequest = AuthorizedGet($"/api/valuation-requests/{Guid.NewGuid():D}");
        var missing = await client.SendAsync(missingRequest);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        using var createRequest = AuthorizedPost(
            "/api/valuation-requests",
            new SaveValuationRequestRequest
            {
                PropId = "",
                Area = "",
                Type = "",
                Appraiser = "",
                Status = "",
            });
        var create = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);

        using var comparablesRequest = AuthorizedGet("/api/comparable-properties");
        var comparables = await client.SendAsync(comparablesRequest);
        Assert.Equal(HttpStatusCode.OK, comparables.StatusCode);

        using var missingComparable = AuthorizedGet($"/api/comparable-properties/{Guid.NewGuid():D}");
        var comparable404 = await client.SendAsync(missingComparable);
        Assert.Equal(HttpStatusCode.NotFound, comparable404.StatusCode);

        using var createComparable = AuthorizedPost("/api/comparable-properties", new { });
        var comparable400 = await client.SendAsync(createComparable);
        Assert.Equal(HttpStatusCode.BadRequest, comparable400.StatusCode);
        Assert.Equal("application/problem+json", comparable400.Content.Headers.ContentType?.MediaType);

        using var recallsRequest = AuthorizedGet("/api/evaluator-recalls");
        var recalls = await client.SendAsync(recallsRequest);
        Assert.Equal(HttpStatusCode.OK, recalls.StatusCode);

        using var missingRecall = AuthorizedGet("/api/evaluator-recalls/missing-task");
        var recallEmpty = await client.SendAsync(missingRecall);
        Assert.Equal(HttpStatusCode.OK, recallEmpty.StatusCode);
    }

    [DockerFact]
    public async Task Reporting_dashboard_executes_with_stubbed_upstreams()
    {
        using var factory = Factory<ReportingMarker>("Reporting");
        using var client = factory.CreateClient();

        using var canonicalRequest = AuthorizedGet("/api/reporting/dashboard");
        var canonical = await client.SendAsync(canonicalRequest);
        Assert.Equal(HttpStatusCode.OK, canonical.StatusCode);

        using var aliasRequest = AuthorizedGet("/api/reporting/v1/dashboard");
        var alias = await client.SendAsync(aliasRequest);
        Assert.Equal(HttpStatusCode.OK, alias.StatusCode);
        Assert.Equal(
            await canonical.Content.ReadAsStringAsync(),
            await alias.Content.ReadAsStringAsync());
    }

    [DockerFact]
    public async Task Identity_users_list_and_create_validation_execute()
    {
        using var factory = Factory<IdentityMarker>("Identity");
        using var client = factory.CreateClient();

        using var listRequest = AuthorizedGet("/api/users");
        var list = await client.SendAsync(listRequest);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);

        using var overviewRequest = AuthorizedGet("/api/users/organization");
        var overview = await client.SendAsync(overviewRequest);
        Assert.Equal(HttpStatusCode.OK, overview.StatusCode);

        using var createRequest = AuthorizedPost("/api/users", new
        {
            displayName = "",
            email = "",
            mobile = "",
            city = "",
            roleId = "",
            nationalId = "",
        });
        var create = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal("application/problem+json", create.Content.Headers.ContentType?.MediaType);
    }

    [DockerFact]
    public async Task Survey_offices_failure_catalog_and_dispatch_gates_execute()
    {
        using var operationsFactory = Factory<OperationsMarker>("Operations");
        using var operations = operationsFactory.CreateClient();

        using var officesRequest = AuthorizedGet("/api/survey-offices");
        var offices = await operations.SendAsync(officesRequest);
        Assert.Equal(HttpStatusCode.OK, offices.StatusCode);

        using var missingOffice = AuthorizedGet($"/api/survey-offices/{Guid.NewGuid():D}");
        var office404 = await operations.SendAsync(missingOffice);
        Assert.Equal(HttpStatusCode.NotFound, office404.StatusCode);

        using var failuresFactory = Factory<FailuresMarker>("Failures");
        using var failures = failuresFactory.CreateClient();

        using var catalogRequest = AuthorizedGet("/api/failure-types-catalog");
        var catalog = await failures.SendAsync(catalogRequest);
        Assert.Equal(HttpStatusCode.OK, catalog.StatusCode);

        using var gatesRequest = AuthorizedGet(
            "/api/failure-dispatch/gates?poNumber=PO-F6-MISSING&propertyId=missing");
        var gates = await failures.SendAsync(gatesRequest);
        Assert.Equal(HttpStatusCode.OK, gates.StatusCode);

        using var approvedRequest = AuthorizedGet("/api/failure-dispatch/approved-keys");
        var approved = await failures.SendAsync(approvedRequest);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
    }

    [DockerFact]
    public async Task Case_study_workspaces_ops_metrics_and_inspection_limits_execute()
    {
        using var factory = Factory<CaseStudyMarker>("CaseStudy");
        using var client = factory.CreateClient();

        using var workspacesRequest = AuthorizedGet("/api/field-inspection-workspaces");
        var workspaces = await client.SendAsync(workspacesRequest);
        Assert.Equal(HttpStatusCode.OK, workspaces.StatusCode);

        using var summaryRequest = AuthorizedGet("/api/field-inspection-workspaces/summary");
        var summary = await client.SendAsync(summaryRequest);
        Assert.Equal(HttpStatusCode.OK, summary.StatusCode);

        using var metricsRequest = AuthorizedGet("/api/workflow-tasks/ops-metrics");
        var metrics = await client.SendAsync(metricsRequest);
        Assert.Equal(HttpStatusCode.OK, metrics.StatusCode);

        using var limitsRequest = AuthorizedGet(
            $"/api/work-orders/PO-F6-MISSING/properties/{Guid.NewGuid():D}/inspection-limits");
        var limits = await client.SendAsync(limitsRequest);
        Assert.Equal(HttpStatusCode.NotFound, limits.StatusCode);

        using var groupRequest = AuthorizedGet(
            $"/api/property-groups/by-property/{Guid.NewGuid():D}");
        var group = await client.SendAsync(groupRequest);
        Assert.Equal(HttpStatusCode.OK, group.StatusCode);
    }

    [DockerFact]
    public async Task Financial_court_visit_and_key_receipt_lists_execute()
    {
        using var factory = Factory<FinancialMarker>("Financial");
        using var client = factory.CreateClient();

        using var courtVisitRequest = AuthorizedGet("/api/financial-dispatch/court-visit-charges");
        var courtVisit = await client.SendAsync(courtVisitRequest);
        Assert.Equal(HttpStatusCode.OK, courtVisit.StatusCode);

        using var keyReceiptRequest = AuthorizedGet("/api/financial-dispatch/key-receipt-charges");
        var keyReceipt = await client.SendAsync(keyReceiptRequest);
        Assert.Equal(HttpStatusCode.OK, keyReceipt.StatusCode);
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

    private static HttpRequestMessage AuthorizedPut<TBody>(string path, TBody body)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, path)
        {
            Content = JsonContent.Create(body),
        };
        Authorize(request);
        return request;
    }

    private static HttpRequestMessage AuthorizedDelete(string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, path);
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
        ArgumentException.ThrowIfNullOrWhiteSpace(serviceName);
        _connectionString = connectionString;
        _serviceName = serviceName;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        BoundedContextConnections.ApplyDedicatedSettings(
            (key, value) => builder.UseSetting(key, value),
            _connectionString);
        builder.UseSetting("Jwt:SigningKey", TestSigningKey);
        builder.UseSetting("Redis:Enabled", "false");
        builder.UseSetting("RabbitMQ:Enabled", "false");
        builder.UseSetting("RabbitMQ:RequireEnabled", "false");
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

            DbContextOptions<TContext> StreamOptions<TContext>() where TContext : DbContext =>
                new DbContextOptionsBuilder<TContext>()
                    .UseNpgsql(_connectionString, npgsql => npgsql.MigrationsHistoryTable(
                        BoundedContextMigrations.HistoryTable,
                        BoundedContextMigrations.HistorySchemaFor<TContext>()))
                    .Options;

 // A9 moved cross-context reads to owner HTTP APIs, but this test boots one host at a
 // time against a single database that holds every schema — re-point the remote
 // lookups at their EF implementations so bodies still execute real SQL. The contexts
 // are registered KEYED so they never join constructor resolution (several services
 // keep equal-arity EF/interface constructor pairs that would turn ambiguous).
            const string testKey = "container-tests";
            if (_serviceName != "CaseStudy")
            {
                services.AddKeyedScoped(
                    testKey,
                    (_, _) => new CaseStudyDbContext(StreamOptions<CaseStudyDbContext>()));
                services.AddScoped<ICaseStudyLookup>(sp =>
                    new CaseStudyLookup(sp.GetRequiredKeyedService<CaseStudyDbContext>(testKey)));
                services.AddScoped<IWorkflowAssigneeLookup>(sp =>
                    new WorkflowAssigneeLookup(sp.GetRequiredKeyedService<CaseStudyDbContext>(testKey)));
            }

            if (_serviceName != "Identity")
            {
                services.AddKeyedScoped(
                    testKey,
                    (_, _) => new IdentityDbContext(StreamOptions<IdentityDbContext>()));
                services.AddScoped<IIdentityDirectory>(sp =>
                    new IdentityDirectory(sp.GetRequiredKeyedService<IdentityDbContext>(testKey)));
                services.AddScoped<IUserLabelLookup>(sp =>
                    sp.GetRequiredService<IIdentityDirectory>());
            }

            if (_serviceName != "Failures")
            {
                services.AddKeyedScoped(
                    testKey,
                    (_, _) => new FailuresDbContext(StreamOptions<FailuresDbContext>()));
                services.AddScoped<IFailureLookup>(sp =>
                    new FailureLookup(sp.GetRequiredKeyedService<FailuresDbContext>(testKey)));
            }

            if (_serviceName == "Reporting")
                services.AddScoped<IReportingUpstreamClient, EmptyReportingUpstreamClient>();
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
            new("prototypeRole", "case-specialist"),
            new(PlatformCapabilities.ClaimType, PlatformCapabilities.Authenticated),
        };
        claims.AddRange(PlatformCapabilities.All.Select(
            capability => new Claim(PlatformCapabilities.ClaimType, capability)));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

internal sealed class EmptyReportingUpstreamClient : IReportingUpstreamClient
{
    public Task<IReadOnlyList<ValuationRequestDto>> GetValuationRequestsAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ValuationRequestDto>>([]);

    public Task<IReadOnlyList<WorkflowTaskDto>> GetWorkflowTasksAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<WorkflowTaskDto>>([]);

    public Task<DashboardOpsMetricsDto> GetOpsMetricsAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult(new DashboardOpsMetricsDto());

    public Task<FieldInspectionWorkspaceSummaryDto> GetFieldInspectionSummaryAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult(new FieldInspectionWorkspaceSummaryDto());

    public Task<IReadOnlyList<FailureRecordDto>> GetFailuresAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<FailureRecordDto>>([]);

    public Task<InspectorFeesSummaryDto> GetInspectorFeesSummaryAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult(new InspectorFeesSummaryDto());

    public Task<int> GetFailureCountAsync(CancellationToken cancellationToken) =>
        Task.FromResult(0);

    public Task<int> GetPropertyCountAsync(CancellationToken cancellationToken) =>
        Task.FromResult(0);
}
