using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RealEstateEval.Identity.Application.Rules;
using RealEstateEval.Identity.Infrastructure.Sms;

namespace RealEstateEval.Application.Tests;

/// <summary>The request OurSMS documents: bearer key, <c>/msgs/sms</c>, digits-only destination.</summary>
public class OurSmsSenderTests
{
    [Fact]
    public async Task Sends_the_documented_request_shape()
    {
        var handler = new CapturingHandler(HttpStatusCode.OK, """{"jobId":"j-1"}""");
        var sender = Build(handler);

        var result = await sender.SendAsync("+966512345678", "hello");

        Assert.True(result.Sent);
        Assert.Equal("j-1", result.ProviderMessageId);
        Assert.Equal("https://api.oursms.com/msgs/sms", handler.Request!.RequestUri!.ToString());
        Assert.Equal("Bearer", handler.Request.Headers.Authorization!.Scheme);
        Assert.Equal("k-123", handler.Request.Headers.Authorization.Parameter);
        using var body = JsonDocument.Parse(handler.Body!);
        Assert.Equal("EJADAH-SA", body.RootElement.GetProperty("src").GetString());
        Assert.Equal("966512345678", body.RootElement.GetProperty("dests")[0].GetString());
        Assert.Equal("hello", body.RootElement.GetProperty("body").GetString());
        Assert.Equal("transactional", body.RootElement.GetProperty("msgClass").GetString());
    }

    [Fact]
    public async Task A_refusal_is_reported_not_thrown()
    {
        var sender = Build(new CapturingHandler(HttpStatusCode.Unauthorized, "nope"));

        var result = await sender.SendAsync("+966512345678", "hello");

        Assert.False(result.Sent);
        Assert.Contains("401", result.Error);
    }

    [Fact]
    public void A_disabled_provider_counts_as_not_configured_even_with_a_key()
    {
        Assert.True(new OurSmsOptions { ApiKey = "k", Sender = "S" }.IsConfigured);
        Assert.False(new OurSmsOptions { ApiKey = "k", Sender = "S", Enabled = false }.IsConfigured);
        Assert.False(new OurSmsOptions { Sender = "S" }.IsConfigured);
    }

    [Fact]
    public void Message_text_carries_the_code_and_the_lifetime()
    {
        var text = LoginOtpRules.MessageText("123456");
        Assert.Contains("123456", text);
        Assert.Contains("5 دقائق", text);
        Assert.True(LoginOtpRules.IsWellFormed("123456"));
        Assert.False(LoginOtpRules.IsWellFormed("12345"));
        Assert.False(LoginOtpRules.IsWellFormed("12345a"));
    }

    [Fact]
    public void Retry_after_respects_the_cooldown_and_the_window_budget()
    {
        var now = new DateTime(2026, 10, 14, 9, 0, 0, DateTimeKind.Utc);
        Assert.Equal(0, LoginOtpRules.RetryAfterSeconds(now, null, []));
        Assert.Equal(20, LoginOtpRules.RetryAfterSeconds(now, now.AddSeconds(-10), [now.AddSeconds(-10)]));
        Assert.Equal(0, LoginOtpRules.RetryAfterSeconds(now, now.AddSeconds(-31), [now.AddSeconds(-31)]));

        var five = Enumerable.Range(0, LoginOtpRules.MaxRequestsPerWindow)
            .Select(i => now.AddMinutes(-14).AddSeconds(i * 40))
            .ToList();
        Assert.Equal(60, LoginOtpRules.RetryAfterSeconds(now, null, five));
    }

    private static OurSmsSender Build(HttpMessageHandler handler) =>
        new(
            new HttpClient(handler),
            Options.Create(new OurSmsOptions { ApiKey = "k-123", Sender = "EJADAH-SA" }),
            NullLogger<OurSmsSender>.Instance);

    private sealed class CapturingHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }
        public string? Body { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Request = request;
            Body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status) { Content = new StringContent(body) };
        }
    }
}
