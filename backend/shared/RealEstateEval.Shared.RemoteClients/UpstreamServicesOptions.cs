using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;

namespace RealEstateEval.Infrastructure.Services;

public sealed class UpstreamServicesOptions
{
    public const string SectionName = "UpstreamServices";

    public string AttachmentsBaseUrl { get; set; } = "http://localhost:5169";
    public string IdentityBaseUrl { get; set; } = "http://localhost:5161";
    public string PlatformBaseUrl { get; set; } = "http://localhost:5168";
    public string FailuresBaseUrl { get; set; } = "http://localhost:5167";
    public string CaseStudyBaseUrl { get; set; } = "http://localhost:5162";
    public string ValuationBaseUrl { get; set; } = "http://localhost:5166";
    public string FinancialBaseUrl { get; set; } = "http://localhost:5165";
    public string OperationsBaseUrl { get; set; } = "http://localhost:5163";
}

/// <summary>
/// JSON for owner-to-owner HTTP. Matches API host settings: camelCase names and string enums.
/// </summary>
public static class OwnerApiJson
{
    public static JsonSerializerOptions Options { get; } = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };
}

/// <summary>Authenticated JSON calls to another owner API. Forwards the inbound Authorization header.</summary>
internal static class UpstreamJson
{
    public static JsonSerializerOptions JsonOpts => OwnerApiJson.Options;

    /// <param name="asService">
    /// Send the service's own token instead of the caller's: a system check (actor = none)
    /// must not be filtered by what the person behind the request may open.
    /// </param>
    public static async Task<T> GetAsync<T>(
        HttpClient http,
        IHttpContextAccessor httpContext,
        string? baseUrl,
        string path,
        string settingName,
        CancellationToken cancellationToken,
        bool asService = false)
    {
        var value = await GetOrDefaultAsync<T>(
            http, httpContext, baseUrl, path, settingName, cancellationToken, allowNotFound: false, asService);
        if (value is null)
            throw new InvalidOperationException($"Empty {settingName} response for {path}.");
        return value;
    }

    public static async Task<T?> GetOrDefaultAsync<T>(
        HttpClient http,
        IHttpContextAccessor httpContext,
        string? baseUrl,
        string path,
        string settingName,
        CancellationToken cancellationToken,
        bool allowNotFound = true,
        bool asService = false)
    {
        using var request = CreateRequest(httpContext, baseUrl, HttpMethod.Get, path, settingName, asService: asService);
        using var response = await http.SendAsync(request, cancellationToken);
        if (allowNotFound && response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return default;
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(JsonOpts, cancellationToken);
    }

    public static async Task<byte[]?> GetBytesOrDefaultAsync(
        HttpClient http,
        IHttpContextAccessor httpContext,
        string? baseUrl,
        string path,
        string settingName,
        CancellationToken cancellationToken)
    {
        using var request = CreateRequest(httpContext, baseUrl, HttpMethod.Get, path, settingName);
        using var response = await http.SendAsync(request, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return null;
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsByteArrayAsync(cancellationToken);
    }

    public static async Task<T> SendAsync<T>(
        HttpClient http,
        IHttpContextAccessor httpContext,
        string? baseUrl,
        HttpMethod method,
        string path,
        object? body,
        string settingName,
        CancellationToken cancellationToken)
    {
        using var request = CreateRequest(httpContext, baseUrl, method, path, settingName, body);
        using var response = await http.SendAsync(request, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            var error = await TryReadErrorAsync(response, cancellationToken);
            throw new UpstreamConflictException(error ?? "conflict");
        }

        response.EnsureSuccessStatusCode();
        var value = await response.Content.ReadFromJsonAsync<T>(JsonOpts, cancellationToken);
        if (value is null)
            throw new InvalidOperationException($"Empty {settingName} response for {path}.");
        return value;
    }

    public static async Task PostAsync(
        HttpClient http,
        IHttpContextAccessor httpContext,
        string? baseUrl,
        string path,
        object? body,
        string settingName,
        CancellationToken cancellationToken)
    {
        using var request = CreateRequest(httpContext, baseUrl, HttpMethod.Post, path, settingName, body);
        using var response = await http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public static Task<(T? Result, Dictionary<string, string>? Errors)> PostForResultAsync<T>(
        HttpClient http,
        IHttpContextAccessor httpContext,
        string? baseUrl,
        string path,
        object? body,
        string settingName,
        CancellationToken cancellationToken) =>
        SendForResultAsync<T>(
            http, httpContext, baseUrl, HttpMethod.Post, path, body, settingName, cancellationToken);

    public static async Task<(T? Result, Dictionary<string, string>? Errors)> SendForResultAsync<T>(
        HttpClient http,
        IHttpContextAccessor httpContext,
        string? baseUrl,
        HttpMethod method,
        string path,
        object? body,
        string settingName,
        CancellationToken cancellationToken)
    {
        using var request = CreateRequest(httpContext, baseUrl, method, path, settingName, body);
        using var response = await http.SendAsync(request, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.BadRequest)
        {
            var errors = await TryReadFieldErrorsAsync(response, cancellationToken);
            return (default, errors ?? new Dictionary<string, string> { ["_"] = "الطلب غير صالح." });
        }

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return (default, null);

        response.EnsureSuccessStatusCode();
        if (response.StatusCode == System.Net.HttpStatusCode.NoContent
            || response.Content.Headers.ContentLength == 0)
        {
            return (default, null);
        }

        var value = await response.Content.ReadFromJsonAsync<T>(JsonOpts, cancellationToken);
        return (value, null);
    }

    public static async Task DeleteAsync(
        HttpClient http,
        IHttpContextAccessor httpContext,
        string? baseUrl,
        string path,
        string settingName,
        CancellationToken cancellationToken)
    {
        using var request = CreateRequest(httpContext, baseUrl, HttpMethod.Delete, path, settingName);
        using var response = await http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    /// <summary>The owner's general refusal (<c>_</c>) when it sent one, else its first field error.</summary>
    public static string? FirstError(Dictionary<string, string>? errors) =>
        errors is null || errors.Count == 0
            ? null
            : errors.TryGetValue("_", out var message) ? message : errors.Values.First();

    /// <summary>
    /// The request to <c>{baseUrl}{path}</c>: the caller's authorization forwarded and the JSON body
    /// attached when there is one. Throws when the owner's base URL is not configured.
    /// </summary>
    private static HttpRequestMessage CreateRequest(
        IHttpContextAccessor httpContext,
        string? baseUrl,
        HttpMethod method,
        string path,
        string settingName,
        object? body = null,
        bool asService = false)
    {
        var root = (baseUrl ?? "").TrimEnd('/');
        if (string.IsNullOrWhiteSpace(root))
        {
            throw new InvalidOperationException(
                $"{settingName} is required when using an owner HTTP lookup.");
        }

        var request = new HttpRequestMessage(method, $"{root}{path}");
        ForwardAuthorization(httpContext, request, asService);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        return request;
    }

    /// <summary>Puts the Authorization header and the X-REE-Upstream marker on an owner-to-owner request.</summary>
    /// <remarks>
    /// How it works: picks the first non-blank of 1) the service's own token
    /// (<c>UpstreamServiceBearer.Ambient</c>) when <paramref name="asService"/> is set, 2) the incoming
    /// request's Authorization header, 3) the service's own token (no person behind the call — event
    /// consumers, hosted sweeps). Adds it when found, and always adds X-REE-Upstream: 1.
    /// Edge cases: 2026-10-21 — a system check (actor = null) used to forward the person's token, so the
    /// attachments service filtered out photos that person cannot read (prod PO-067455); asService now
    /// sends the service token first. If no service token is configured it falls back to the caller's.
    /// </remarks>
    private static void ForwardAuthorization(
        IHttpContextAccessor httpContext,
        HttpRequestMessage request,
        bool asService = false)
    {
        var authorization = asService
            ? UpstreamServiceBearer.Ambient?.GetAuthorizationHeader()
            : null;
        if (string.IsNullOrWhiteSpace(authorization))
            authorization = httpContext.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization))
            authorization = UpstreamServiceBearer.Ambient?.GetAuthorizationHeader();
        if (!string.IsNullOrWhiteSpace(authorization))
            request.Headers.TryAddWithoutValidation("Authorization", authorization);
        request.Headers.TryAddWithoutValidation("X-REE-Upstream", "1");
    }

    private static async Task<string?> TryReadErrorAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOpts, cancellationToken);
            if (payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("error", out var error))
                return error.GetString();
        }
        catch (JsonException)
        {
        }

        return null;
    }

    private static async Task<Dictionary<string, string>?> TryReadFieldErrorsAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOpts, cancellationToken);
            if (payload.ValueKind != JsonValueKind.Object)
                return null;

            if (payload.TryGetProperty("errors", out var errors)
                && errors.ValueKind == JsonValueKind.Object)
            {
                var map = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var property in errors.EnumerateObject())
                {
                    if (property.Value.ValueKind == JsonValueKind.String)
                        map[property.Name] = property.Value.GetString() ?? "";
                }

                if (map.Count > 0)
                    return map;
            }

            if (payload.TryGetProperty("error", out var error))
            {
                var message = error.GetString();
                if (!string.IsNullOrWhiteSpace(message))
                    return new Dictionary<string, string> { ["_"] = message };
            }
        }
        catch (JsonException)
        {
        }

        return null;
    }
}

internal sealed class UpstreamConflictException(string error) : Exception(error)
{
    public string Error { get; } = error;
}
