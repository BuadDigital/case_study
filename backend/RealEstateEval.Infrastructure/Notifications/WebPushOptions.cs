namespace RealEstateEval.Infrastructure.Notifications;

public sealed class WebPushOptions
{
    public const string SectionName = "WebPush";

    public bool Enabled { get; set; }
    public string PublicKey { get; set; } = "";
    public string PrivateKey { get; set; } = "";
 /// <summary>mailto: or https: contact URI required by VAPID.</summary>
    public string Subject { get; set; } = "mailto:ops@ejada.local";
    public int TtlSeconds { get; set; } = 86_400;
}
