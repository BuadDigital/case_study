extern alias CaseStudyApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;

using CaseStudyDispatchMarker = CaseStudyApi::RealEstateEval.CaseStudy.Api.Controllers.CaseStudyDispatchController;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// The A9 dispatch surface other services depend on (Valuation context read, Failures
/// side effects), executed over HTTP against a migrated Postgres.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class CaseStudyDispatchPostgresTests : IAsyncLifetime
{
    private readonly PostgresFixture _postgres;
    private string _connectionString = "";
    private Guid _propertyId;
    private Guid _taskId;
    private string _poNumber = "";

    public CaseStudyDispatchPostgresTests(PostgresFixture postgres) => _postgres = postgres;

    public async Task InitializeAsync()
    {
        if (!DockerEnvironment.IsAvailable)
            return;

        _connectionString = await _postgres.EnsureDatabaseAsync("controller_bodies");
        await BoundedContextStreamMigrator.ApplyAllStreamsAsync(_connectionString);

        _poNumber = $"PO-DSP-{Guid.NewGuid():N}"[..20];
        _propertyId = Guid.NewGuid();
        _taskId = Guid.NewGuid();
        var workOrderId = Guid.NewGuid();

        await using var cs = (CaseStudyDbContext)BoundedContextStreamMigrator.CreateStreamContext(
            typeof(CaseStudyDbContext),
            _connectionString);
        cs.WorkOrders.Add(new WorkOrder
        {
            Id = workOrderId,
            PoNumber = _poNumber,
            PromulgationDate = new DateOnly(2026, 8, 1),
            ReceivedFromEnfathAt = new DateOnly(2026, 8, 2),
            DueDateAt = new DateOnly(2026, 9, 1),
            CreatedAtUtc = DateTime.UtcNow,
        });
        cs.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = _propertyId,
            WorkOrderId = workOrderId,
            DeedNumber = "D-DSP-1",
            City = "الرياض",
            District = "حي الياسمين",
            PropertyType = "villa",
            HasStructuresToValue = "yes",
        });
        cs.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            _poNumber,
            DateTime.UtcNow,
            title: "دراسة الحالة",
            id: _taskId,
            propertyId: _propertyId,
            assigneeId: "assignee-dsp-1"));
        await cs.SaveChangesAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [DockerFact]
    public async Task Valuation_property_context_returns_the_aggregate_and_404_for_unknown()
    {
        using var factory = new RealDatabaseApiFactory<CaseStudyDispatchMarker>(
            _connectionString,
            "CaseStudy");
        using var client = factory.CreateClient();

        var context = await GetAsync<CaseStudyValuationPropertyContextDto>(
            client,
            $"/api/case-study-dispatch/valuation-property-context/{_propertyId:D}");
        Assert.Equal(_propertyId, context.Id);
        Assert.Equal(_poNumber, context.PoNumber);
        Assert.Equal("yes", context.HasStructuresToValue);
        Assert.Equal("villa", context.PropertyType);

        using var missingRequest = Authorized(
            HttpMethod.Get,
            $"/api/case-study-dispatch/valuation-property-context/{Guid.NewGuid():D}");
        var missing = await client.SendAsync(missingRequest);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [DockerFact]
    public async Task Po_numbers_by_assignee_returns_the_seeded_po()
    {
        using var factory = new RealDatabaseApiFactory<CaseStudyDispatchMarker>(
            _connectionString,
            "CaseStudy");
        using var client = factory.CreateClient();

        var pos = await GetAsync<List<string>>(
            client,
            "/api/case-study-dispatch/po-numbers-by-assignee?ids=assignee-dsp-1,unknown");
        Assert.Contains(_poNumber, pos);
    }

    [DockerFact]
    public async Task Hold_block_and_unblock_flip_the_case_study_task_and_report_its_assignee()
    {
        using var factory = new RealDatabaseApiFactory<CaseStudyDispatchMarker>(
            _connectionString,
            "CaseStudy");
        using var client = factory.CreateClient();

        var blocked = await PostAsync<CaseStudyHoldTaskResultDto>(
            client,
            "/api/case-study-dispatch/case-study-tasks/block-for-hold",
            new CaseStudyHoldTaskRequest
            {
                PoNumber = _poNumber,
                PropertyId = _propertyId,
                Reason = "محظر إخلاء",
            });
        Assert.Equal(_taskId, blocked.TaskId);
        Assert.Equal("assignee-dsp-1", blocked.AssigneeId);
        await AssertTaskStatusAsync(WorkflowTaskStatus.Blocked);

        var unblocked = await PostAsync<CaseStudyHoldTaskResultDto>(
            client,
            "/api/case-study-dispatch/case-study-tasks/unblock-for-hold",
            new CaseStudyHoldTaskRequest
            {
                PoNumber = _poNumber,
                PropertyId = _propertyId,
            });
        Assert.Equal(_taskId, unblocked.TaskId);
        await AssertTaskStatusAsync(WorkflowTaskStatus.Open);
    }

    [DockerFact]
    public async Task Deed_status_command_updates_the_property_by_failure_identifiers()
    {
        using var factory = new RealDatabaseApiFactory<CaseStudyDispatchMarker>(
            _connectionString,
            "CaseStudy");
        using var client = factory.CreateClient();

        using var request = Authorized(
            HttpMethod.Post,
            "/api/case-study-dispatch/properties/deed-status");
        request.Content = JsonContent.Create(new SetCaseStudyDeedStatusRequest
        {
            PoNumber = _poNumber,
            PropertyId = "D-DSP-1",
            DeedNumber = "D-DSP-1",
            DeedStatus = "قيد التحقق",
        });
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        await using var cs = (CaseStudyDbContext)BoundedContextStreamMigrator.CreateStreamContext(
            typeof(CaseStudyDbContext),
            _connectionString);
        var deedStatus = await cs.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == _propertyId)
            .Select(p => p.DeedStatus)
            .SingleAsync();
        Assert.Equal("قيد التحقق", deedStatus);
    }

    [DockerFact]
    public async Task Timeline_record_is_idempotent_per_event_key()
    {
        using var factory = new RealDatabaseApiFactory<CaseStudyDispatchMarker>(
            _connectionString,
            "CaseStudy");
        using var client = factory.CreateClient();

        var eventKey = $"failure:{Guid.NewGuid():N}:created";
        for (var i = 0; i < 2; i++)
        {
            using var request = Authorized(
                HttpMethod.Post,
                "/api/case-study-dispatch/property-timeline/record");
            request.Content = JsonContent.Create(new PropertyTimelineRecordRequest(
                _poNumber,
                _propertyId,
                eventKey,
                "تسجيل تعذر",
                "تفاصيل",
                "warn",
                DateTime.UtcNow));
            var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        await using var cs = (CaseStudyDbContext)BoundedContextStreamMigrator.CreateStreamContext(
            typeof(CaseStudyDbContext),
            _connectionString);
        var rows = await cs.PropertyTimelineEntries.AsNoTracking()
            .CountAsync(e => e.PoNumber == _poNumber && e.EventKey == eventKey);
        Assert.Equal(1, rows);
    }

    private async Task AssertTaskStatusAsync(WorkflowTaskStatus expected)
    {
        await using var cs = (CaseStudyDbContext)BoundedContextStreamMigrator.CreateStreamContext(
            typeof(CaseStudyDbContext),
            _connectionString);
        var status = await cs.WorkflowTasks.AsNoTracking()
            .Where(t => t.Id == _taskId)
            .Select(t => t.Status)
            .SingleAsync();
        Assert.Equal(expected, status);
    }

    private static HttpRequestMessage Authorized(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", ContainerAuthHandler.Token);
        // Owner-to-owner dispatch routes are gated by RequireUpstreamDispatch; UpstreamJson always sends this.
        request.Headers.TryAddWithoutValidation("X-REE-Upstream", "1");
        return request;
    }

    private static async Task<T> GetAsync<T>(HttpClient client, string path)
    {
        using var request = Authorized(HttpMethod.Get, path);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<T>();
        Assert.NotNull(body);
        return body;
    }

    private static async Task<T> PostAsync<T>(HttpClient client, string path, object body)
    {
        using var request = Authorized(HttpMethod.Post, path);
        request.Content = JsonContent.Create(body);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<T>();
        Assert.NotNull(result);
        return result;
    }
}
