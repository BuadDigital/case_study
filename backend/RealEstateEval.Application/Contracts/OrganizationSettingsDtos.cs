namespace RealEstateEval.Application.Contracts;

public sealed class OrganizationSettingsDto
{
    public OrganizationCompanySettingsDto Company { get; init; } = new();
    public OrganizationEvaluatorSettingsDto Evaluator { get; init; } = new();
    public OrganizationBrandingSettingsDto Branding { get; init; } = new();
    public OrganizationCommunicationsSettingsDto Communications { get; init; } = new();
    public OrganizationSlaSettingsDto Sla { get; init; } = new();
    public DateTime UpdatedAtUtc { get; init; }
}

public sealed class OrganizationCompanySettingsDto
{
    public string Name { get; init; } = "شركة إجادة المهنية للتقييم";
    public string? TaxNumber { get; init; }
    public string? Address { get; init; }
}

public sealed class OrganizationEvaluatorSettingsDto
{
    public string? Name { get; init; }
    public string? LicenseNumber { get; init; }
    public string? MembershipNumber { get; init; }
}

public sealed class OrganizationBrandingSettingsDto
{
    public string StampUrl { get; init; } = "/case-study/ejadah-stamp.png";
    public string SignatureUrl { get; init; } = "/case-study/ejadah-signature.png";
    public string? HeaderUrl { get; init; }
    public string WatermarkText { get; init; } = "EJADAH";
}

public sealed class OrganizationCommunicationsSettingsDto
{
    /// <summary>dev-log | sms | email</summary>
    public string OtpProvider { get; init; } = "dev-log";
    public string DefaultOtpChannel { get; init; } = "sms";
    public string? SmsSenderId { get; init; }
    public string? EmailFrom { get; init; }

    public string? SmsApiUrl { get; init; }
    /// <summary>Write-only on save; never returned in clear text from GET.</summary>
    public string? SmsApiKey { get; init; }
    public bool SmsApiKeyConfigured { get; init; }

    public string? SmtpHost { get; init; }
    public int SmtpPort { get; init; } = 587;
    public string? SmtpUsername { get; init; }
    /// <summary>Write-only on save; never returned in clear text from GET.</summary>
    public string? SmtpPassword { get; init; }
    public bool SmtpPasswordConfigured { get; init; }
}

public sealed class OrganizationSlaSettingsDto
{
    public int DefaultBusinessDays { get; init; } = 4;
    public int PrivateSectorBusinessDays { get; init; } = 10;
}

public sealed class SaveOrganizationSettingsRequest
{
    public OrganizationCompanySettingsDto? Company { get; init; }
    public OrganizationEvaluatorSettingsDto? Evaluator { get; init; }
    public OrganizationBrandingSettingsDto? Branding { get; init; }
    public OrganizationCommunicationsSettingsDto? Communications { get; init; }
    public OrganizationSlaSettingsDto? Sla { get; init; }
}

public sealed class TestCommunicationRequest
{
    public string Channel { get; init; } = "sms";
    public string Destination { get; init; } = "";
}

public sealed class TestCommunicationResultDto
{
    public bool Ok { get; init; }
    public string Provider { get; init; } = "";
    public string? Detail { get; init; }
}
