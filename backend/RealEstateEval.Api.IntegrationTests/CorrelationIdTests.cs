using System.Net.Http.Headers;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Api.IntegrationTests;

public class CorrelationIdSanitizerTests
{
    [Theory]
    [InlineData("0f8fad5bd9cb469fa16570867728950e")]
    [InlineData("REQ-2026-07-29_001")]
    [InlineData("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")]
    [InlineData("caller.service:42")]
    public void Id_shaped_values_are_kept(string candidate)
    {
        Assert.Equal(candidate, CorrelationIdMiddleware.Sanitize(candidate));
    }

    [Fact]
    public void Surrounding_whitespace_is_trimmed()
    {
        Assert.Equal("abc123", CorrelationIdMiddleware.Sanitize("  abc123 \t"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
 // Header injection, log forging, and response splitting.
    [InlineData("abc\r\nX-Injected: 1")]
    [InlineData("abc\ndef")]
    [InlineData("abc\u0000def")]
 // Anything that would land unescaped in a log message or a dashboard filter.
    [InlineData("<script>alert(1)</script>")]
    [InlineData("id with spaces")]
    [InlineData("id\"quoted\"")]
    public void Unsafe_values_are_rejected(string? candidate)
    {
        Assert.Null(CorrelationIdMiddleware.Sanitize(candidate));
    }

    [Fact]
    public void Oversized_values_are_rejected()
    {
        var tooLong = new string('a', CorrelationIdMiddleware.MaxLength + 1);

        Assert.Null(CorrelationIdMiddleware.Sanitize(tooLong));
        Assert.NotNull(CorrelationIdMiddleware.Sanitize(tooLong[..^1]));
    }
}

public class CorrelationIdResponseTests : IClassFixture<FinancialApiWebApplicationFactory>
{
    private readonly HttpClient _client;

    public CorrelationIdResponseTests(FinancialApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task A_well_formed_caller_id_is_echoed_back()
    {
        const string callerId = "caller-supplied-1234";

        var response = await SendAsync(callerId);

        Assert.Equal(callerId, Header(response));
    }

    [Fact]
    public async Task A_malformed_caller_id_is_replaced_rather_than_echoed()
    {
        var response = await SendAsync("bad\r\nX-Injected: 1");

        var issued = Header(response);
        Assert.DoesNotContain("X-Injected", issued);
        Assert.NotNull(CorrelationIdMiddleware.Sanitize(issued));
    }

    [Fact]
    public async Task Repeated_headers_are_replaced_with_a_single_issued_id()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.TryAddWithoutValidation(CorrelationIdMiddleware.HeaderName, "first-id");
        request.Headers.TryAddWithoutValidation(CorrelationIdMiddleware.HeaderName, "second-id");

        var response = await _client.SendAsync(request);

        var issued = Header(response);
        Assert.NotEqual("first-id", issued);
        Assert.NotEqual("second-id", issued);
        Assert.NotNull(CorrelationIdMiddleware.Sanitize(issued));
    }

    [Fact]
    public async Task Every_response_carries_a_correlation_id()
    {
        var response = await _client.GetAsync("/health");

        Assert.False(string.IsNullOrWhiteSpace(Header(response)));
    }

    private async Task<HttpResponseMessage> SendAsync(string correlationId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.TryAddWithoutValidation(
            CorrelationIdMiddleware.HeaderName,
            correlationId);

        return await _client.SendAsync(request);
    }

    private static string Header(HttpResponseMessage response) =>
        response.Headers.TryGetValues(CorrelationIdMiddleware.HeaderName, out var values)
            ? string.Join(",", values)
            : string.Empty;
}
