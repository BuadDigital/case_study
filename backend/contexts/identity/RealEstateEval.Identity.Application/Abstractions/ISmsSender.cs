namespace RealEstateEval.Identity.Application.Abstractions;

/// <summary>
/// Outbound SMS. One implementation talks to the provider (OurSMS); the development
/// fallback writes the message to the log so the stack runs without an API key.
/// </summary>
public interface ISmsSender
{
    /// <summary><see cref="SmsChannels.Sms"/> for a real provider, <see cref="SmsChannels.Dev"/> for the log fallback.</summary>
    string Channel { get; }

    /// <param name="mobileE164">Normalized Saudi mobile, e.g. <c>+9665XXXXXXXX</c>.</param>
    Task<SmsSendResult> SendAsync(string mobileE164, string text, CancellationToken cancellationToken = default);
}

public static class SmsChannels
{
    public const string Sms = "sms";
    public const string Dev = "dev";
}

public sealed record SmsSendResult(bool Sent, string? ProviderMessageId = null, string? Error = null)
{
    public static SmsSendResult Ok(string? providerMessageId = null) => new(true, providerMessageId);
    public static SmsSendResult Failed(string error) => new(false, null, error);
}
