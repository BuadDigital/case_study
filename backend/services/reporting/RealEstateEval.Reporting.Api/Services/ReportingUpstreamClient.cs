using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Reporting.Api.Services;

public sealed class UpstreamServicesOptions
{
  public string GatewayBaseUrl { get; set; } = "http://localhost:5160";
  public string? CaseStudyBaseUrl { get; set; }
  public string? ValuationBaseUrl { get; set; }
  public string? FailuresBaseUrl { get; set; }

  public string BaseUrlFor(string path)
  {
    if (path.StartsWith("/api/valuation", StringComparison.OrdinalIgnoreCase))
      return (ValuationBaseUrl ?? GatewayBaseUrl).TrimEnd('/');
    if (path.StartsWith("/api/failures", StringComparison.OrdinalIgnoreCase))
      return (FailuresBaseUrl ?? GatewayBaseUrl).TrimEnd('/');
    return (CaseStudyBaseUrl ?? GatewayBaseUrl).TrimEnd('/');
  }
}

public interface IReportingUpstreamClient
{
    Task<IReadOnlyList<ValuationRequestDto>> GetValuationRequestsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowTaskDto>> GetWorkflowTasksAsync(CancellationToken cancellationToken);
    Task<int> GetFailureCountAsync(CancellationToken cancellationToken);
    Task<int> GetPropertyCountAsync(CancellationToken cancellationToken);
}

public sealed class ReportingUpstreamClient : IReportingUpstreamClient
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly UpstreamServicesOptions _options;

    public ReportingUpstreamClient(
        HttpClient http,
        IHttpContextAccessor httpContextAccessor,
        IOptions<UpstreamServicesOptions> options)
    {
        _http = http;
        _httpContextAccessor = httpContextAccessor;
        _options = options.Value;
    }

    public Task<IReadOnlyList<ValuationRequestDto>> GetValuationRequestsAsync(
        CancellationToken cancellationToken) =>
        GetJsonAsync<IReadOnlyList<ValuationRequestDto>>("/api/valuation-requests", cancellationToken);

    public Task<IReadOnlyList<WorkflowTaskDto>> GetWorkflowTasksAsync(
        CancellationToken cancellationToken) =>
        GetJsonAsync<IReadOnlyList<WorkflowTaskDto>>("/api/workflow-tasks", cancellationToken);

    public async Task<int> GetFailureCountAsync(CancellationToken cancellationToken)
    {
        var failures = await GetJsonAsync<IReadOnlyList<object>>("/api/failures", cancellationToken);
        return failures.Count;
    }

    public async Task<int> GetPropertyCountAsync(CancellationToken cancellationToken)
    {
        var orders = await GetJsonAsync<IReadOnlyList<WorkOrderListItemDto>>(
            "/api/work-orders",
            cancellationToken);
        return orders.Sum(o => o.PropertyCount);
    }

    private async Task<T> GetJsonAsync<T>(string path, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Get, path);
        using var response = await _http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var value = await JsonSerializer.DeserializeAsync<T>(stream, JsonOpts, cancellationToken);
        if (value is null)
            throw new InvalidOperationException($"Empty upstream response for {path}.");
        return value;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path)
    {
        var baseUrl = _options.BaseUrlFor(path);
        var request = new HttpRequestMessage(method, $"{baseUrl}{path}");
        var authorization = _httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authorization))
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
        return request;
    }
}
