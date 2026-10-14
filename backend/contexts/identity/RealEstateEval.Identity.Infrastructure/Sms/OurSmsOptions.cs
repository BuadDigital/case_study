namespace RealEstateEval.Identity.Infrastructure.Sms;

/// <summary>
/// OurSMS (oursms.com) credentials. With no <see cref="ApiKey"/> the host falls back to the
/// log sender, so a development stack never needs the real key.
/// </summary>
public sealed class OurSmsOptions
{
    public const string SectionName = "Sms:OurSms";

    /// <summary>
    /// Master switch. Off, the key may stay configured but nothing is sent: the code goes to the
    /// log and a dev-login host accepts any code (the "dummy" login the team runs with today).
    /// </summary>
    public bool Enabled { get; set; } = true;

    public string BaseUrl { get; set; } = "https://api.oursms.com";

    /// <summary>API key from the OurSMS keys manager — sent as a bearer token.</summary>
    public string ApiKey { get; set; } = "";

    /// <summary>Registered sender id shown on the handset (<c>src</c>).</summary>
    public string Sender { get; set; } = "";

    public int TimeoutSeconds { get; set; } = 15;

    public bool IsConfigured => Enabled && !string.IsNullOrWhiteSpace(ApiKey);
}
