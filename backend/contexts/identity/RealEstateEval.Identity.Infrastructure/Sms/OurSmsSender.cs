using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Identity.Application.Abstractions;

namespace RealEstateEval.Identity.Infrastructure.Sms;

/// <summary>
/// OurSMS HTTP API v1: <c>POST {BaseUrl}/msgs/sms</c> with <c>Authorization: Bearer {ApiKey}</c>
/// and a JSON body of <c>src</c>, <c>dests</c> (digits only, country code first) and <c>body</c>.
/// </summary>
public sealed class OurSmsSender(
    HttpClient http,
    IOptions<OurSmsOptions> options,
    ILogger<OurSmsSender> logger) : ISmsSender
{
    public const string HttpClientName = "oursms";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public string Channel => SmsChannels.Sms;

    public async Task<SmsSendResult> SendAsync(
        string mobileE164,
        string text,
        CancellationToken cancellationToken = default)
    {
        var o = options.Value;
        if (!o.IsConfigured)
            return SmsSendResult.Failed("OurSMS api key is not configured.");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            new Uri(new Uri(o.BaseUrl.TrimEnd('/') + "/"), "msgs/sms"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", o.ApiKey);
        request.Content = JsonContent.Create(BuildPayload(o.Sender, mobileE164, text), options: Json);

        try
        {
            using var response = await http.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "OurSMS refused the message: {Status} {Body}",
                    (int)response.StatusCode,
                    Truncate(body));
                return SmsSendResult.Failed($"OurSMS responded {(int)response.StatusCode}.");
            }

            return SmsSendResult.Ok(ReadMessageId(body));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "OurSMS call failed");
            return SmsSendResult.Failed("OurSMS is unreachable.");
        }
    }

    /// <summary>Request body as the API documents it; OTP traffic is transactional and top priority.</summary>
    public static OurSmsPayload BuildPayload(string sender, string mobileE164, string text) =>
        new(
            Src: sender,
            Dests: [DigitsOnly(mobileE164)],
            Body: text,
            Priority: 1,
            MsgClass: "transactional");

    /// <summary><c>+966501234567</c> → <c>966501234567</c>; the API wants no plus sign.</summary>
    public static string DigitsOnly(string mobile) =>
        new(mobile.Where(char.IsAsciiDigit).ToArray());

    private static string? ReadMessageId(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                return null;
            foreach (var name in new[] { "jobId", "msgId", "id" })
            {
                if (root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
                    return value.GetString();
            }
        }
        catch (JsonException)
        {
            // The response shape is not documented; the id is a nicety for logs only.
        }
        return null;
    }

    private static string Truncate(string s) => s.Length <= 300 ? s : s[..300];
}

/// <summary>JSON body for <c>POST /msgs/sms</c>; property names follow the OurSMS docs.</summary>
public sealed record OurSmsPayload(
    [property: JsonPropertyName("src")] string Src,
    [property: JsonPropertyName("dests")] string[] Dests,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("priority")] int Priority,
    [property: JsonPropertyName("msgClass")] string MsgClass);
