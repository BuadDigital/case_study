namespace RealEstateEval.Platform.Application.Contracts;

public sealed record PushConfigDto(bool Enabled, string? PublicKey);

public sealed record PushSubscriptionDto(
    Guid Id,
    string Endpoint,
    string? UserAgent,
    string? DeviceLabel,
    DateTime CreatedAtUtc,
    DateTime LastSeenAtUtc,
    DateTime? DisabledAtUtc);

public sealed record RegisterPushSubscriptionRequest(
    string Endpoint,
    string P256dh,
    string Auth,
    string? UserAgent,
    string? DeviceLabel);

public sealed record DeletePushSubscriptionRequest(string Endpoint);

public sealed record PushPreferenceDto(bool PushEnabled);

public sealed record SetPushPreferenceRequest(bool PushEnabled);
