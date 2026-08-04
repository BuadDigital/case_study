using System.Net;
using System.Text;
using System.Text.Json;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Shared.Contracts;
using PushSub = RealEstateEval.Domain.PushSubscription;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Delivers a persisted notification to all enabled Web Push subscriptions for a user.</summary>
public sealed class WebPushDeliveryHandler
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly MessagingDbContext _db;
    private readonly WebPushOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WebPushDeliveryHandler> _logger;

    public WebPushDeliveryHandler(
        MessagingDbContext db,
        IOptions<WebPushOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<WebPushDeliveryHandler> logger)
    {
        _db = db;
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task DeliverAsync(
        NotificationUserCreatedPayload payload,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled ||
            string.IsNullOrWhiteSpace(_options.PublicKey) ||
            string.IsNullOrWhiteSpace(_options.PrivateKey))
        {
            return;
        }

        if (payload.Read) return;
        if (string.Equals(payload.SourceEvent, "self-authored", StringComparison.OrdinalIgnoreCase))
            return;
        if (payload.SourceEvent?.StartsWith("local:", StringComparison.OrdinalIgnoreCase) == true)
            return;

        var preference = await _db.PushPreferences.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == payload.UserId, cancellationToken);
        if (preference is { PushEnabled: false }) return;

        var subscriptions = await _db.PushSubscriptions
            .Where(x => x.UserId == payload.UserId && x.DisabledAtUtc == null)
            .ToListAsync(cancellationToken);
        if (subscriptions.Count == 0) return;

        var body = Truncate(payload.Body, 200);
        var json = JsonSerializer.Serialize(
            new
            {
                id = payload.Id,
                title = Truncate(payload.Title, 80) ?? "إجادة",
                body,
                href = payload.Href ?? "/",
                tone = payload.Tone,
                category = payload.Category,
                sourceEvent = payload.SourceEvent,
            },
            JsonOpts);

        if (Encoding.UTF8.GetByteCount(json) > 3900)
        {
            json = JsonSerializer.Serialize(
                new
                {
                    id = payload.Id,
                    title = Truncate(payload.Title, 60) ?? "إجادة",
                    body = Truncate(body, 80),
                    href = payload.Href ?? "/",
                    sourceEvent = payload.SourceEvent,
                },
                JsonOpts);
        }

        var client = new PushServiceClient(_httpClientFactory.CreateClient("webpush"))
        {
            DefaultAuthentication = new VapidAuthentication(_options.PublicKey, _options.PrivateKey)
            {
                Subject = _options.Subject,
            },
            DefaultTimeToLive = _options.TtlSeconds,
        };

        foreach (var sub in subscriptions)
        {
            await SendOneAsync(client, sub, json, cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task SendOneAsync(
        PushServiceClient client,
        PushSub sub,
        string json,
        CancellationToken cancellationToken)
    {
        var pushSubscription = new Lib.Net.Http.WebPush.PushSubscription
        {
            Endpoint = sub.Endpoint,
            Keys = new Dictionary<string, string>
            {
                ["p256dh"] = sub.P256dh,
                ["auth"] = sub.Auth,
            },
        };

        try
        {
            var message = new PushMessage(json)
            {
                Topic = sub.Id.ToString("N"),
                Urgency = PushMessageUrgency.Normal,
            };
            await client.RequestPushMessageDeliveryAsync(pushSubscription, message, cancellationToken);
            sub.LastSuccessAtUtc = DateTime.UtcNow;
            sub.ConsecutiveFailures = 0;
        }
        catch (PushServiceClientException ex) when (
            ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
        {
            sub.DisabledAtUtc = DateTime.UtcNow;
            sub.DisabledReason = $"http:{(int)ex.StatusCode}";
            _logger.LogInformation(
                "Disabled expired push subscription {SubscriptionId} for user {UserId}",
                sub.Id,
                sub.UserId);
        }
        catch (Exception ex)
        {
            sub.ConsecutiveFailures += 1;
            if (sub.ConsecutiveFailures >= 5)
            {
                sub.DisabledAtUtc = DateTime.UtcNow;
                sub.DisabledReason = "consecutive-failures";
            }

            _logger.LogWarning(
                ex,
                "Web push delivery failed for subscription {SubscriptionId}",
                sub.Id);
        }
    }

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return value;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
