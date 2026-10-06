extern alias CaseStudyApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Api.IntegrationTests;

public sealed class CaseStudyBatch2cApiFactory : ServiceApiFactory<CaseStudyApi::Program>
{
    public RecordingTransactionState State { get; } = new();
    public IWorkflowTaskService Tasks { get; }
    public IPartyTaskSubmissionService Submissions { get; }
    public ProxyCalls TaskCalls { get; } = new();
    public ProxyCalls SubmissionCalls { get; } = new();

    public WorkflowTaskPatchStateDto? PatchState { get; set; }

    public CaseStudyBatch2cApiFactory()
    {
        Tasks = RecordingProxy<IWorkflowTaskService>.Create(TaskCalls, (method, _) => method.Name switch
        {
            nameof(IWorkflowTaskService.GetPatchStateAsync) => Task.FromResult(PatchState),
            nameof(IWorkflowTaskService.PatchAsync) => Task.FromResult<WorkflowTaskDto?>(new WorkflowTaskDto()),
            _ => throw new NotSupportedException(method.Name),
        });
        Submissions = RecordingProxy<IPartyTaskSubmissionService>.Create(SubmissionCalls, (method, _) => method.Name switch
        {
            nameof(IPartyTaskSubmissionService.ReopenForRecallAsync) =>
                Task.FromResult<(PartyTaskSubmissionDto?, Dictionary<string, string>?)>((
                    new PartyTaskSubmissionDto { Payload = JsonDocument.Parse("{}").RootElement }, null)),
            _ => throw new NotSupportedException(method.Name),
        });
    }

    protected override string ServiceName => "CaseStudy";

    protected override void ConfigureServiceTestServices(IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddSingleton<ITransactionStateService>(State);
        services.AddSingleton(Tasks);
        services.AddSingleton(Submissions);
        services.AddScoped<IPermissionService, HeaderRolePermissions>();
    }
}

public sealed class ProxyCalls
{
    public List<(string Method, object?[] Args)> Calls { get; } = [];
    public void Clear() => Calls.Clear();
}

/// <summary>A throwaway fake for a wide interface: records every call and answers the ones the test wires.</summary>
public class RecordingProxy<T> : DispatchProxy where T : class
{
    private ProxyCalls _calls = new();
    private Func<MethodInfo, object?[], object?> _handler = (m, _) => throw new NotSupportedException(m.Name);

    public static T Create(ProxyCalls calls, Func<MethodInfo, object?[], object?> handler)
    {
        var proxy = Create<T, RecordingProxy<T>>();
        var typed = (RecordingProxy<T>)(object)proxy;
        typed._calls = calls;
        typed._handler = handler;
        return proxy;
    }

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        _calls.Calls.Add((targetMethod!.Name, args ?? []));
        return _handler(targetMethod, args ?? []);
    }
}

public sealed class RecordingTransactionState : ITransactionStateService
{
    public List<string> Calls { get; } = [];
    public Dictionary<string, string>? NextReturnErrors { get; set; }
    public string? NextHandoverError { get; set; }

    public Task<TransactionStateDto?> GetStateAsync(
        Guid workOrderId, Guid propertyId, CancellationToken cancellationToken = default) =>
        throw new NotSupportedException();

    public Task<(TransactionStateDto? Result, string? Error)> RecordEnfazHandoverAsync(
        Guid workOrderId, Guid propertyId, string? recordedByUserId, CancellationToken cancellationToken = default)
    {
        Calls.Add("handover");
        return Task.FromResult<(TransactionStateDto?, string?)>(
            NextHandoverError is null ? (State(), null) : (null, NextHandoverError));
    }

    public Task<(TransactionStateDto? Result, Dictionary<string, string>? Errors)> ReturnFromEnfazAsync(
        Guid workOrderId,
        Guid propertyId,
        ReturnFromEnfazRequest request,
        CaseStudyReportActor actor,
        CancellationToken cancellationToken = default)
    {
        Calls.Add($"return:{actor.PrototypeRole}:{request.ReopenStudy}:{request.ReopenValuation}:{request.Reason}");
        return Task.FromResult<(TransactionStateDto?, Dictionary<string, string>?)>(
            NextReturnErrors is null ? (State(), null) : (null, NextReturnErrors));
    }

    public Task<string?> RecordPostEnfazDecisionAsync(
        Guid workOrderId, Guid propertyId, PostEnfazDecisionRequest request, string? actorId, string? actorRole,
        CancellationToken cancellationToken = default) =>
        throw new NotSupportedException();

    private static TransactionStateDto State() =>
        new() { OverallStatus = "in_progress", OverallStatusLabelAr = "قيد العمل" };
}

/// <summary>
/// Batch 2C on the case-study host: the Enfaz handover and return are the case specialist's
/// alone (the capability is shared with the supervisor, the GM and the CDO), the generic task
/// patch refuses to complete / reopen a case-study parent, and the trusted recall-reopen route is
/// upstream-only and re-checks the role.
/// </summary>
public class CaseStudyBatch2cAuthorizationTests : IClassFixture<CaseStudyBatch2cApiFactory>
{
    private static readonly Guid WorkOrderId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid PropertyId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid TaskId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    private static readonly string CaseStaff = TestAuthHandler.TokenFor(PlatformCapabilities.ManageWorkOrders);
    private static readonly string StateUrl =
        $"/api/work-orders/{WorkOrderId}/properties/{PropertyId}/transaction-state";

    private readonly CaseStudyBatch2cApiFactory _factory;
    private readonly HttpClient _client;

    public CaseStudyBatch2cAuthorizationTests(CaseStudyBatch2cApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _factory.State.Calls.Clear();
        _factory.State.NextReturnErrors = null;
        _factory.State.NextHandoverError = null;
        _factory.TaskCalls.Clear();
        _factory.SubmissionCalls.Clear();
        _factory.PatchState = null;
    }

    private static HttpRequestMessage Send(
        HttpMethod method,
        string url,
        string token,
        string? role = null,
        object? body = null,
        bool upstream = false)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (role is not null) request.Headers.Add(HeaderRolePermissions.RoleHeader, role);
        if (upstream) request.Headers.Add("X-REE-Upstream", "1");
        if (body is not null) request.Content = JsonContent.Create(body);
        return request;
    }

    // ------------------------------------------------------------ enfaz handover

    [Fact]
    public async Task The_case_specialist_hands_over_to_enfaz()
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Post, StateUrl + "/enfaz-handover", CaseStaff, "case-specialist"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["handover"], _factory.State.Calls);
    }

    [Theory]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("cdo")]
    [InlineData(null)]
    public async Task Nobody_else_hands_over_to_enfaz(string? role)
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Post, StateUrl + "/enfaz-handover", CaseStaff, role));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(_factory.State.Calls);
    }

    [Fact]
    public async Task A_blocked_handover_is_a_400_with_the_reasons()
    {
        _factory.State.NextHandoverError = "لا يمكن رفع المعاملة على إنفاذ: تقرير دراسة الحالة لم يُصدَر بعد";

        var response = await _client.SendAsync(Send(
            HttpMethod.Post, StateUrl + "/enfaz-handover", CaseStaff, "case-specialist"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ------------------------------------------------------------ enfaz return

    [Fact]
    public async Task The_case_specialist_takes_the_transaction_back_from_enfaz()
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Post,
            StateUrl + "/enfaz-return",
            CaseStaff,
            "case-specialist",
            new { reason = "ظهر خطأ في المساحة", reopenStudy = true, reopenValuation = false }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["return:case-specialist:True:False:ظهر خطأ في المساحة"], _factory.State.Calls);
    }

    [Theory]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("cdo")]
    [InlineData(null)]
    public async Task Nobody_else_takes_it_back(string? role)
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Post,
            StateUrl + "/enfaz-return",
            CaseStaff,
            role,
            new { reason = "ظهر خطأ في المساحة", reopenStudy = true, reopenValuation = true }));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(_factory.State.Calls);
    }

    [Fact]
    public async Task A_refused_return_is_a_400()
    {
        _factory.State.NextReturnErrors = new Dictionary<string, string> { ["reason"] = "السبب مطلوب" };

        var response = await _client.SendAsync(Send(
            HttpMethod.Post,
            StateUrl + "/enfaz-return",
            CaseStaff,
            "case-specialist",
            new { reason = "", reopenStudy = true, reopenValuation = false }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task The_return_route_needs_the_capability_too()
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Post,
            StateUrl + "/enfaz-return",
            TestAuthHandler.AuthOnlyToken,
            "case-specialist",
            new { reason = "ظهر خطأ في المساحة", reopenStudy = true, reopenValuation = false }));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ------------------------------------------------------------ generic patch hardening

    [Theory]
    [InlineData("completed", null)]
    [InlineData(null, "done")]
    public async Task A_parent_cannot_be_completed_through_the_patch(string? status, string? phase)
    {
        _factory.PatchState = new WorkflowTaskPatchStateDto
        {
            Kind = WorkflowTaskKind.CaseStudyProperty,
            Status = WorkflowTaskStatus.Open,
            Phase = WorkflowTaskPhase.CaseStudy,
        };

        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, $"/api/workflow-tasks/{TaskId}", CaseStaff, "case-specialist", new { status, phase }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain(_factory.TaskCalls.Calls, c => c.Method == nameof(IWorkflowTaskService.PatchAsync));
    }

    [Fact]
    public async Task A_completed_parent_cannot_be_reopened_through_the_patch()
    {
        _factory.PatchState = new WorkflowTaskPatchStateDto
        {
            Kind = WorkflowTaskKind.CaseStudyProperty,
            Status = WorkflowTaskStatus.Completed,
            Phase = WorkflowTaskPhase.Done,
        };

        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, $"/api/workflow-tasks/{TaskId}", CaseStaff, "section-supervisor",
            new { status = "open", phase = "case-study" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain(_factory.TaskCalls.Calls, c => c.Method == nameof(IWorkflowTaskService.PatchAsync));
    }

    [Fact]
    public async Task Resolving_an_obstruction_still_passes_status_open_on_the_parent()
    {
        _factory.PatchState = new WorkflowTaskPatchStateDto
        {
            Kind = WorkflowTaskKind.CaseStudyProperty,
            Status = WorkflowTaskStatus.Blocked,
            Phase = WorkflowTaskPhase.Obstruction,
        };

        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, $"/api/workflow-tasks/{TaskId}", CaseStaff, "case-specialist",
            new { phase = "bourse", status = "open", assigneeRole = "case-specialist", obstructionReason = "" }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(_factory.TaskCalls.Calls, c => c.Method == nameof(IWorkflowTaskService.PatchAsync));
    }

    [Fact]
    public async Task A_child_task_still_completes_through_the_patch()
    {
        _factory.PatchState = new WorkflowTaskPatchStateDto
        {
            Kind = WorkflowTaskKind.EngineeringSurvey,
            Status = WorkflowTaskStatus.Open,
            Phase = WorkflowTaskPhase.Done,
        };

        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, $"/api/workflow-tasks/{TaskId}", CaseStaff, "case-specialist",
            new { status = "completed", phase = "done" }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Suspending_a_parent_through_the_patch_still_works()
    {
        _factory.PatchState = new WorkflowTaskPatchStateDto
        {
            Kind = WorkflowTaskKind.CaseStudyProperty,
            Status = WorkflowTaskStatus.Open,
            Phase = WorkflowTaskPhase.CaseStudy,
        };

        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, $"/api/workflow-tasks/{TaskId}", CaseStaff, "general-manager",
            new { status = "blocked", obstructionReason = "معاملة معلقة" }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Patching_an_unknown_task_is_a_404()
    {
        _factory.PatchState = null;

        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, $"/api/workflow-tasks/{TaskId}", CaseStaff, "case-specialist", new { title = "x" }));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ------------------------------------------------------------ trusted recall reopen

    private static string RecallUrl =>
        $"/api/case-study-dispatch/party-submissions/{TaskId}/reopen-for-recall";

    [Fact]
    public async Task The_recall_reopen_route_is_upstream_only()
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Post, RecallUrl, CaseStaff, "case-specialist", new { reason = "خطأ" }, upstream: false));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(_factory.SubmissionCalls.Calls);
    }

    [Fact]
    public async Task The_recall_reopen_runs_for_the_forwarded_specialist()
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Post, RecallUrl, CaseStaff, "case-specialist", new { reason = "خطأ" }, upstream: true));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var call = Assert.Single(_factory.SubmissionCalls.Calls);
        Assert.Equal(nameof(IPartyTaskSubmissionService.ReopenForRecallAsync), call.Method);
        Assert.Equal(TaskId, call.Args[0]);
        Assert.Equal("case-specialist", ((PartySubmissionActor)call.Args[2]!).PrototypeRole);
    }
}
