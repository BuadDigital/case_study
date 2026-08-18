using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
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

public class StructuredLoggingTests
{
    [Fact]
    public void Production_uses_json_console_by_default()
    {
        Assert.True(StructuredLogging.UseJsonConsole(Configuration([]), Environment("Production")));
    }

    [Fact]
    public void Development_keeps_the_readable_console_by_default()
    {
        Assert.False(StructuredLogging.UseJsonConsole(Configuration([]), Environment("Development")));
    }

    [Fact]
    public void Configuration_overrides_the_environment_default()
    {
        Assert.True(StructuredLogging.UseJsonConsole(
            Configuration(new Dictionary<string, string?>
            {
                [StructuredLogging.JsonConsoleLoggingKey] = "true",
            }),
            Environment("Development")));
    }

    private static IConfiguration Configuration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static IHostEnvironment Environment(string environmentName) =>
        new TestHostEnvironment { EnvironmentName = environmentName };

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider
        {
            get => new Microsoft.Extensions.FileProviders.NullFileProvider();
            set => throw new NotSupportedException();
        }
    }
}

public class CorrelationIdForwardingTests
{
    [Fact]
    public void TryAdd_writes_a_missing_id()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "http://localhost/");

        CorrelationIdForwarding.TryAdd(request.Headers, "caller-1");

        Assert.Equal("caller-1", request.Headers.GetValues(CorrelationIdMiddleware.HeaderName).Single());
    }

    [Fact]
    public void TryAdd_does_not_replace_an_existing_id()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "http://localhost/");
        request.Headers.TryAddWithoutValidation(CorrelationIdMiddleware.HeaderName, "kept");

        CorrelationIdForwarding.TryAdd(request.Headers, "other");

        Assert.Equal("kept", request.Headers.GetValues(CorrelationIdMiddleware.HeaderName).Single());
    }

    [Fact]
    public void Overwrite_replaces_a_forged_inbound_header()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "http://localhost/");
        request.Headers.TryAddWithoutValidation(CorrelationIdMiddleware.HeaderName, "forged");

        CorrelationIdForwarding.Overwrite(request.Headers, "issued-id");

        Assert.Equal("issued-id", request.Headers.GetValues(CorrelationIdMiddleware.HeaderName).Single());
    }

    [Fact]
    public void Overwrite_drops_an_unsafe_value()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "http://localhost/");
        request.Headers.TryAddWithoutValidation(CorrelationIdMiddleware.HeaderName, "kept");

        CorrelationIdForwarding.Overwrite(request.Headers, "bad\r\nX-Injected: 1");

        Assert.False(request.Headers.Contains(CorrelationIdMiddleware.HeaderName));
    }

    [Fact]
    public async Task Delegating_handler_copies_trace_identifier_onto_outbound_calls()
    {
        var accessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext { TraceIdentifier = "trace-abc" },
        };
        var inner = new CaptureHandler();
        using var handler = new CorrelationIdDelegatingHandler(accessor) { InnerHandler = inner };
        using var client = new HttpClient(handler);

        await client.GetAsync("http://localhost/lookup");

        Assert.Equal(
            "trace-abc",
            inner.Last!.Headers.GetValues(CorrelationIdMiddleware.HeaderName).Single());
    }
}

public class CorrelationIdLogScopeTests
{
    [Fact]
    public async Task Request_scope_includes_correlation_id_and_service()
    {
        var logger = new ScopeLogger();
        var middleware = new CorrelationIdMiddleware(
            _ => Task.CompletedTask,
            logger,
            new ObservabilityLabels { ServiceName = "financial" });
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationIdMiddleware.HeaderName] = "caller-scope-1";

        await middleware.InvokeAsync(context);

        Assert.NotNull(logger.LastScope);
        Assert.Equal("caller-scope-1", logger.LastScope![CorrelationIdMiddleware.LogScopeKey]);
        Assert.Equal("financial", logger.LastScope["Service"]);
    }

    private sealed class ScopeLogger : ILogger<CorrelationIdMiddleware>
    {
        public Dictionary<string, object>? LastScope { get; private set; }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
        {
            if (state is IEnumerable<KeyValuePair<string, object>> pairs)
                LastScope = pairs.ToDictionary(pair => pair.Key, pair => pair.Value);
            return NullScope.Instance;
        }

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose()
            {
            }
        }
    }
}

file sealed class CaptureHandler : HttpMessageHandler
{
    public HttpRequestMessage? Last { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        Last = request;
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
    }
}
