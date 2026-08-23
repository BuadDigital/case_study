namespace RealEstateEval.Application.Contracts;

public sealed class OrganizationSettingsDto
{
    public OrganizationCompanySettingsDto Company { get; init; } = new();
    public OrganizationEvaluatorSettingsDto Evaluator { get; init; } = new();
    public List<OrganizationValuerRosterEntryDto> Valuers { get; init; } = [];
    public OrganizationBrandingSettingsDto Branding { get; init; } = new();
    public OrganizationCommunicationsSettingsDto Communications { get; init; } = new();
    public OrganizationSlaSettingsDto Sla { get; init; } = new();
    public OrganizationValuationSettingsDto Valuation { get; init; } = new();
    public OrganizationValuationReportSettingsDto ValuationReport { get; init; } = new();
    public DateTime UpdatedAtUtc { get; init; }
}

/// <summary>تبويب تقرير التقييم — الطبقة ب (القرار 25): ثوابت ونصوص تُعبَّأ مرة وتُستهلك في كل تقرير.</summary>
public sealed class OrganizationValuationReportSettingsDto
{
    public string ReportType { get; init; } = "";
    public string Currency { get; init; } = "";
    public string ValuationBranch { get; init; } = "";
    public string KeyInputsText { get; init; } = "";
    public string ProfessionalStandards { get; init; } = "";
    public string Independence { get; init; } = "";
    public string ResearchScopeText { get; init; } = "";
    public string Terms { get; init; } = "";
    public string Restrictions { get; init; } = "";
    public string IvsStandards { get; init; } = "";
    public string Glossary { get; init; } = "";
    public string FinishingLuxury { get; init; } = "";
    public string FinishingMedium { get; init; } = "";
    public string FinishingOrdinary { get; init; } = "";
 /// <summary>بنود الافتراضات الخاصة الجاهزة — يديرها الأدمن وينتقي منها المقيّم.</summary>
    public List<string> SpecialAssumptionLibrary { get; init; } = [];
}

public sealed class OrganizationCompanySettingsDto
{
    public string Name { get; init; } = "شركة إجادة المهنية للتقييم العقاري";
    public string? TaxNumber { get; init; }
    public string? Address { get; init; }
    public string? CommercialRegistration { get; init; }
    /// <summary>رقم ترخيص المزاولة للمنشأة (الهيئة).</summary>
    public string? PracticeLicenseNumber { get; init; }
    /// <summary>ISO date — انتهاء ترخيص مزاولة المنشأة.</summary>
    public string? PracticeLicenseExpiresAt { get; init; }
    /// <summary>مرجع المقيّم المعتمد من سجل المقيّمين (certified أو معرّف الصف).</summary>
    public string? CertifiedValuerId { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Website { get; init; }
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
 /// <summary>تاريخ إصدار الترخيص (هجري) كما في هوية المقيم — عرض/تقرير.</summary>
    public string? LicenseIssuedAt { get; init; }
 /// <summary>تاريخ انتهاء الترخيص (هجري) للعرض في الهوية — بوابة الإصدار تبقى على LicenseExpiresAt.</summary>
    public string? LicenseExpiresHijri { get; init; }
 /// <summary>صفته — مثل «الرئيس التنفيذي».</summary>
    public string? Title { get; init; }
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
 /// <summary>certified | valuer | assistant | reviewer — الدور في النظام.</summary>
    public string Role { get; init; } = "assistant";
    public bool IsActive { get; init; } = true;
 /// <summary>توقيع المقيّم للتقارير الجديدة.</summary>
    public string? SignatureUrl { get; init; }
}

public sealed class OrganizationBrandingSettingsDto
{
    public string StampUrl { get; init; } = "/case-study/ejadah-stamp.svg";
    public string SignatureUrl { get; init; } = "/case-study/ejadah-signature.png";
    public string? HeaderUrl { get; init; }
    /// <summary>Report letterhead image — sliced by Letterhead*Mm. Null keeps the template's baked letterhead.</summary>
    public string? LetterheadUrl { get; init; }
    public string WatermarkText { get; init; } = "EJADAH";

    public string? LogoColorUrl { get; init; }
    public string? LogoWhiteUrl { get; init; }
    /// <summary>عرض الختم على A4 (سم) — المصدر: الإعدادات v2 هوية بصرية.</summary>
    public decimal? StampWidthCm { get; init; }
    public decimal? StampHeightCm { get; init; }
    public decimal? LetterheadHeadMm { get; init; }
    public decimal? LetterheadFootTopMm { get; init; }
    /// <summary>الهامش الأيسر (mm).</summary>
    public decimal? LetterheadPadMm { get; init; }
    /// <summary>الهامش الأيمن (mm) — شريحة الجانب في الطباعة.</summary>
    public decimal? LetterheadPadStartMm { get; init; }
    public decimal? LetterheadStripMm { get; init; }
    public string? LogoVersion { get; init; }
    public string? LogoUpdatedAt { get; init; }
    public string? LogoUploadedBy { get; init; }
    public string? StampUpdatedAt { get; init; }
    public string? StampUploadedBy { get; init; }
    public string? LetterheadVersion { get; init; }
    public string? LetterheadUpdatedAt { get; init; }
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