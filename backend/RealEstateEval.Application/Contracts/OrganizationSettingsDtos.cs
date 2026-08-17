namespace RealEstateEval.Application.Contracts;

public sealed class OrganizationSettingsDto
{
    public OrganizationCompanySettingsDto Company { get; init; } = new();
 /// <summary>Certified valuer used by issuance gates — keep singleton.</summary>
    public OrganizationEvaluatorSettingsDto Evaluator { get; init; } = new();
 /// <summary>Additional valuers / assistants for report (roster).</summary>
    public List<OrganizationValuerRosterEntryDto> Valuers { get; init; } = [];
    public OrganizationBrandingSettingsDto Branding { get; init; } = new();
    public OrganizationCommunicationsSettingsDto Communications { get; init; } = new();
    public OrganizationSlaSettingsDto Sla { get; init; } = new();
    public OrganizationValuationSettingsDto Valuation { get; init; } = new();
 /// <summary>تبويب «تقرير التقييم» (القرار 25 — الطبقة ب): حقول التقرير وحده.</summary>
    public OrganizationValuationReportSettingsDto ValuationReport { get; init; } = new();
    public DateTime UpdatedAtUtc { get; init; }
}

/// <summary>تبويب تقرير التقييم — منه مكتبة الافتراضات الخاصة (انتقاء المقيّم).</summary>
public sealed class OrganizationValuationReportSettingsDto
{
 /// <summary>بنود الافتراضات الخاصة الجاهزة — يديرها الأدمن وينتقي منها المقيّم.</summary>
    public List<string> SpecialAssumptionLibrary { get; init; } = [];
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
 /// <summary>fellow | associate | affiliate | student — فئة العضوية.</summary>
    public string? MembershipCategory { get; init; }
 /// <summary>ISO date (yyyy-MM-dd) — license practice expiry (dual gate).</summary>
    public string? LicenseExpiresAt { get; init; }
 /// <summary>ISO date (yyyy-MM-dd) — membership expiry / effective end.</summary>
    public string? MembershipExpiresAt { get; init; }
}

public sealed class OrganizationValuerRosterEntryDto
{
    public string Id { get; init; } = "";
    public string NameAr { get; init; } = "";
    public string? LicenseNumber { get; init; }
    public string? MembershipNumber { get; init; }
 /// <summary>fellow | associate | affiliate | student — فئة العضوية.</summary>
    public string? MembershipCategory { get; init; }
 /// <summary>ISO date (yyyy-MM-dd) — license practice expiry.</summary>
    public string? LicenseExpiresAt { get; init; }
 /// <summary>ISO date (yyyy-MM-dd) — membership expiry / effective end.</summary>
    public string? MembershipExpiresAt { get; init; }
 /// <summary>certified | assistant | reviewer</summary>
    public string Role { get; init; } = "assistant";
    public bool IsActive { get; init; } = true;
}

public sealed class OrganizationBrandingSettingsDto
{
    public string StampUrl { get; init; } = "/case-study/ejadah-stamp.png";
    public string SignatureUrl { get; init; } = "/case-study/ejadah-signature.png";
    public string? HeaderUrl { get; init; }
 /// <summary>Report letterhead image (أصل نظام) — rendered as 3 slices: header ≤41mm, footer from 270mm, sidebar 13mm repeat-y. Null keeps the template's baked letterhead.</summary>
    public string? LetterheadUrl { get; init; }
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

/// <summary>Valuation-engine settings — «حد أقصى قابل للضبط».</summary>
public sealed class OrganizationValuationSettingsDto
{
 /// <summary>Max comparables that can be adopted per valuation (1–20).</summary>
    public int MaxAdoptedComparables { get; init; } = 3;

 /// <summary>ق-4: عتبة الفارق الزمني بالأشهر لتنبيه m20 (بيانات إدارية، 1–60).</summary>
    public int ComparableTimeGapMonths { get; init; } = 6;
}

public sealed class SaveOrganizationSettingsRequest
{
    public OrganizationCompanySettingsDto? Company { get; init; }
    public OrganizationEvaluatorSettingsDto? Evaluator { get; init; }
    public List<OrganizationValuerRosterEntryDto>? Valuers { get; init; }
    public OrganizationBrandingSettingsDto? Branding { get; init; }
    public OrganizationCommunicationsSettingsDto? Communications { get; init; }
    public OrganizationSlaSettingsDto? Sla { get; init; }
    public OrganizationValuationSettingsDto? Valuation { get; init; }
    public OrganizationValuationReportSettingsDto? ValuationReport { get; init; }
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
