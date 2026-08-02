namespace RealEstateEval.Domain;

/// <summary>
/// Singleton organization / system settings (د — company, evaluator, branding, communications, SLA).
/// </summary>
public class OrganizationSettings
{
    public Guid Id { get; set; }
    public string SettingsJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; }
}
