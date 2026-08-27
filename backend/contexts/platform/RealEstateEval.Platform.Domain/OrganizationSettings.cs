namespace RealEstateEval.Platform.Domain;

/// <summary>
/// Singleton organization / system settings (company, evaluator, branding, communications, SLA).
/// </summary>
public class OrganizationSettings
{
    public Guid Id { get; set; }
    public string SettingsJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; }
}
