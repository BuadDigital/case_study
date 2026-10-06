extern alias ValuationApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Api.IntegrationTests;

public sealed class EvaluatorRecallsApiFactory : ServiceApiFactory<ValuationApi::Program>
{
    public RecordingRecalls Recalls { get; } = new();

    protected override string ServiceName => "Valuation";

    protected override void ConfigureServiceTestServices(IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddSingleton<IEvaluatorRecallsService>(Recalls);
        services.AddScoped<IPermissionService, HeaderRolePermissions>();
    }
}

/// <summary>The role is a request header, so one token (capabilities only) can play every role.</summary>
public sealed class HeaderRolePermissions(IHttpContextAccessor http) : IPermissionService
{
    public const string RoleHeader = "X-Test-Role";

    public Task<PermissionsDto?> GetForUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var role = http.HttpContext?.Request.Headers[RoleHeader].ToString();
        return Task.FromResult<PermissionsDto?>(new PermissionsDto
        {
            UserId = userId,
            PrototypeRole = string.IsNullOrWhiteSpace(role) ? null : role,
        });
    }
}

public sealed class RecordingRecalls : IEvaluatorRecallsService
{
    private static readonly EvaluatorRecallDto Row = new()
    {
        TaskId = "t-1",
        PoNumber = "PO-1",
        PropertyId = "p-1",
        Status = "pending",
        Reason = "reason",
        SpecialistNote = "",
    };

    public List<(string TaskId, DecideEvaluatorRecallRequest Request)> Decisions { get; } = [];
    public Dictionary<string, string>? NextErrors { get; set; }

    public Task<IReadOnlyList<EvaluatorRecallDto>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<EvaluatorRecallDto>>([Row]);

    public Task<EvaluatorRecallDto?> GetAsync(string taskId, CancellationToken cancellationToken = default) =>
        Task.FromResult<EvaluatorRecallDto?>(Row);

    public Task<(EvaluatorRecallDto? Result, string? Error)> RequestAsync(
        CreateEvaluatorRecallRequest request, CancellationToken cancellationToken = default) =>
        throw new NotSupportedException();

    public Task<(EvaluatorRecallDto? Result, Dictionary<string, string>? Errors)> DecideAsync(
        string taskId,
        DecideEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default,
        string? actorUserId = null)
    {
        Decisions.Add((taskId, request));
        return Task.FromResult<(EvaluatorRecallDto?, Dictionary<string, string>?)>(
            NextErrors is null ? (Row, null) : (null, NextErrors));
    }
}

/// <summary>
/// Appraiser recalls: the case staff read them, only the case specialist decides. The capability
/// (manage-work-orders) is held by the supervisor, the general manager and the CDO as well, so the
/// role check is what keeps them out.
/// </summary>
public class EvaluatorRecallsAuthorizationTests : IClassFixture<EvaluatorRecallsApiFactory>
{
    private readonly EvaluatorRecallsApiFactory _factory;
    private readonly HttpClient _client;

    public EvaluatorRecallsAuthorizationTests(EvaluatorRecallsApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _factory.Recalls.Decisions.Clear();
        _factory.Recalls.NextErrors = null;
    }

    private static HttpRequestMessage Send(
        HttpMethod method,
        string url,
        string token,
        string? role = null,
        object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (role is not null) request.Headers.Add(HeaderRolePermissions.RoleHeader, role);
        if (body is not null) request.Content = JsonContent.Create(body);
        return request;
    }

    private static readonly string CaseStaff = TestAuthHandler.TokenFor(PlatformCapabilities.ManageWorkOrders);

    // ------------------------------------------------------------ reads

    [Fact]
    public async Task Case_staff_read_the_recall_list_and_one_recall()
    {
        var list = await _client.SendAsync(Send(HttpMethod.Get, "/api/evaluator-recalls", CaseStaff));
        var one = await _client.SendAsync(Send(HttpMethod.Get, "/api/evaluator-recalls/t-1", CaseStaff));

        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal(HttpStatusCode.OK, one.StatusCode);
    }

    [Fact]
    public async Task The_appraiser_still_reads_the_recalls()
    {
        var token = TestAuthHandler.TokenFor(PlatformCapabilities.SubmitValuationReport);
        var response = await _client.SendAsync(Send(HttpMethod.Get, "/api/evaluator-recalls", token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData(TestAuthHandler.AuthOnlyToken)]
    [InlineData("actor:owner-1:field-inspector")]
    public async Task Field_parties_and_bare_sessions_do_not_read_the_recalls(string token)
    {
        var response = await _client.SendAsync(Send(HttpMethod.Get, "/api/evaluator-recalls", token));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ------------------------------------------------------------ decide

    [Fact]
    public async Task The_case_specialist_decides_through_the_new_route()
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Patch,
            "/api/evaluator-recalls/t-1/decide",
            CaseStaff,
            role: "case-specialist",
            body: new { decision = "approve", note = "ok" }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (taskId, request) = Assert.Single(_factory.Recalls.Decisions);
        Assert.Equal("t-1", taskId);
        Assert.Equal("approve", request.Decision);
        Assert.Equal("ok", request.Note);
    }

    [Theory]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("cdo")]
    [InlineData("real-estate-appraiser")]
    public async Task Nobody_else_decides_even_with_the_capability(string role)
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Patch,
            "/api/evaluator-recalls/t-1/decide",
            CaseStaff,
            role,
            new { decision = "approve" }));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(_factory.Recalls.Decisions);
    }

    [Fact]
    public async Task A_session_without_a_role_cannot_decide()
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, "/api/evaluator-recalls/t-1/decide", CaseStaff, role: null, new { decision = "approve" }));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(_factory.Recalls.Decisions);
    }

    [Fact]
    public async Task The_appraiser_capability_alone_cannot_decide_even_as_a_specialist_role()
    {
        var token = TestAuthHandler.TokenFor(PlatformCapabilities.SubmitValuationReport);
        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, "/api/evaluator-recalls/t-1/decide", token, "case-specialist", new { decision = "approve" }));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(_factory.Recalls.Decisions);
    }

    [Fact]
    public async Task The_old_routes_stay_and_carry_the_same_rule()
    {
        var approve = await _client.SendAsync(Send(
            HttpMethod.Patch, "/api/evaluator-recalls/t-1/approve", CaseStaff, "case-specialist"));
        var reject = await _client.SendAsync(Send(
            HttpMethod.Patch, "/api/evaluator-recalls/t-1/reject", CaseStaff, "case-specialist",
            new { specialistNote = "سليم" }));

        Assert.Equal(HttpStatusCode.OK, approve.StatusCode);
        Assert.Equal(HttpStatusCode.OK, reject.StatusCode);
        Assert.Equal(["approve", "reject"], _factory.Recalls.Decisions.Select(d => d.Request.Decision));
        Assert.Equal("سليم", _factory.Recalls.Decisions[1].Request.Note);

        _factory.Recalls.Decisions.Clear();
        var supervisorApprove = await _client.SendAsync(Send(
            HttpMethod.Patch, "/api/evaluator-recalls/t-1/approve", CaseStaff, "section-supervisor"));
        var gmReject = await _client.SendAsync(Send(
            HttpMethod.Patch, "/api/evaluator-recalls/t-1/reject", CaseStaff, "general-manager", new { }));
        Assert.Equal(HttpStatusCode.Forbidden, supervisorApprove.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, gmReject.StatusCode);
        Assert.Empty(_factory.Recalls.Decisions);
    }

    [Fact]
    public async Task A_refusal_from_the_service_is_a_400_with_its_message()
    {
        _factory.Recalls.NextErrors = new Dictionary<string, string> { ["_"] = "التقرير مودَع" };

        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, "/api/evaluator-recalls/t-1/decide", CaseStaff, "case-specialist", new { decision = "approve" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_upstream_failure_is_a_503_so_the_client_can_retry()
    {
        _factory.Recalls.NextErrors = new Dictionary<string, string>
        {
            [EvaluatorRecallDecisions.UpstreamErrorKey] = "down",
        };

        var response = await _client.SendAsync(Send(
            HttpMethod.Patch, "/api/evaluator-recalls/t-1/decide", CaseStaff, "case-specialist", new { decision = "approve" }));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Submitting_a_recall_stays_the_appraisers_capability()
    {
        var response = await _client.SendAsync(Send(
            HttpMethod.Post, "/api/evaluator-recalls", CaseStaff, "case-specialist",
            new { taskId = "t", poNumber = "po", propertyId = "p", reason = "r" }));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
