using System.Linq;
using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Final 27-section reading order (decisions log v2 — clean renumber 1–27).
/// </summary>
public static class ValuationReportSectionKeys
{
    public const string ValuerIdentity = "valuer_identity";
    public const string ScopeOfWork = "scope_of_work";
    public const string KeyInputs = "key_inputs";
    public const string ProfessionalStandards = "professional_standards";
    public const string Independence = "independence";
    public const string SubjectAsset = "subject_asset";
    public const string LocationDetails = "location_details";
    public const string Boundaries = "boundaries";
    public const string AreaUtilities = "area_utilities";
    public const string Surroundings = "surroundings";
    public const string ApproachesUsed = "approaches_used";
    public const string Comparables = "comparables";
    public const string ComparablesMap = "comparables_map";
    public const string Adjustments = "adjustments";
    public const string MethodsRationale = "methods_rationale";
    public const string FinalValue = "final_value";
    public const string Participants = "participants";
    public const string ResearchScope = "research_scope";
    public const string Restrictions = "restrictions";
    public const string SpecialAssumptions = "special_assumptions";
    public const string Terms = "terms";
    public const string SiteMaps = "site_maps";
    public const string Photos = "photos";
    public const string SurveyReport = "survey_report";
    public const string DeedAttachment = "deed_attachment";
    public const string IvsStandards = "ivs_standards";
    public const string Glossary = "glossary";
}

public enum ValuationReportSectionBodyKind
{
 /// <summary>Filled from live valuation / property data.</summary>
    Data = 0,
 /// <summary>Frozen text layer (standards / legal) — version id at issue.</summary>
    FrozenText = 1,
 /// <summary>Attachment / map / photo page container.</summary>
    AttachmentPage = 2,
}

public sealed record ValuationReportSectionDefinition(
    int Number,
    string Key,
    string TitleAr,
    ValuationReportSectionBodyKind BodyKind,
 /// <summary>When true, omit for vacant land (no structures).</summary>
    bool BuildingOnly = false,
 /// <summary>When true, omit unless market approach is weighted/used.</summary>
    bool RequiresMarketApproach = false,
 /// <summary>When true, omit unless cost approach is weighted/used.</summary>
    bool RequiresCostApproach = false,
 /// <summary>When true, omit unless income approach is used (deferred — always off).</summary>
    bool RequiresIncomeApproach = false);

/// <summary>Catalog + land/building / approach conditionals.</summary>
public static class ValuationReportSectionCatalog
{
    public static IReadOnlyList<ValuationReportSectionDefinition> All { get; } =
    [
        new(1, ValuationReportSectionKeys.ValuerIdentity, "هوية المقيم", ValuationReportSectionBodyKind.Data),
        new(2, ValuationReportSectionKeys.ScopeOfWork, "نطاق العمل", ValuationReportSectionBodyKind.Data),
        new(3, ValuationReportSectionKeys.KeyInputs, "المدخلات الرئيسية", ValuationReportSectionBodyKind.Data),
        new(4, ValuationReportSectionKeys.ProfessionalStandards, "المعايير المهنية", ValuationReportSectionBodyKind.FrozenText),
        new(5, ValuationReportSectionKeys.Independence, "إقرار الاستقلالية", ValuationReportSectionBodyKind.FrozenText),
        new(6, ValuationReportSectionKeys.SubjectAsset, "الأصل محل التقييم", ValuationReportSectionBodyKind.Data),
        new(7, ValuationReportSectionKeys.LocationDetails, "تفاصيل موقع العقار", ValuationReportSectionBodyKind.Data),
        new(8, ValuationReportSectionKeys.Boundaries, "حدود وأطوال العقار", ValuationReportSectionBodyKind.Data),
        new(9, ValuationReportSectionKeys.AreaUtilities, "المرافق في منطقة العقار", ValuationReportSectionBodyKind.Data),
        new(10, ValuationReportSectionKeys.Surroundings, "المحيط المؤثر", ValuationReportSectionBodyKind.Data),
        new(11, ValuationReportSectionKeys.ApproachesUsed, "أسلوب وطريقة التقييم", ValuationReportSectionBodyKind.Data),
        new(12, ValuationReportSectionKeys.Comparables, "العقارات المقارنة", ValuationReportSectionBodyKind.Data, RequiresMarketApproach: true),
        new(13, ValuationReportSectionKeys.ComparablesMap, "خريطة المقارنات", ValuationReportSectionBodyKind.AttachmentPage, RequiresMarketApproach: true),
        new(14, ValuationReportSectionKeys.Adjustments, "جدول التسويات", ValuationReportSectionBodyKind.Data, RequiresMarketApproach: true),
        new(15, ValuationReportSectionKeys.MethodsRationale, "مبرر استخدام طرق التقييم", ValuationReportSectionBodyKind.Data),
        new(16, ValuationReportSectionKeys.FinalValue, "القيمة النهائية", ValuationReportSectionBodyKind.Data),
        new(17, ValuationReportSectionKeys.Participants, "المشاركون في إعداد التقرير", ValuationReportSectionBodyKind.Data),
        new(18, ValuationReportSectionKeys.ResearchScope, "نطاق البحث ومصادر المعلومات", ValuationReportSectionBodyKind.Data),
        new(19, ValuationReportSectionKeys.Restrictions, "القيود على الاستخدام والنشر", ValuationReportSectionBodyKind.FrozenText),
        new(20, ValuationReportSectionKeys.SpecialAssumptions, "الافتراضات الخاصة", ValuationReportSectionBodyKind.Data),
        new(21, ValuationReportSectionKeys.Terms, "الشروط والأحكام وإخلاء المسؤولية", ValuationReportSectionBodyKind.FrozenText),
        new(22, ValuationReportSectionKeys.SiteMaps, "خرائط الموقع", ValuationReportSectionBodyKind.AttachmentPage),
        new(23, ValuationReportSectionKeys.Photos, "صور العقار", ValuationReportSectionBodyKind.AttachmentPage),
        new(24, ValuationReportSectionKeys.SurveyReport, "التقرير المساحي", ValuationReportSectionBodyKind.AttachmentPage),
        new(25, ValuationReportSectionKeys.DeedAttachment, "صك الملكية", ValuationReportSectionBodyKind.AttachmentPage),
        new(26, ValuationReportSectionKeys.IvsStandards, "المعايير الدولية", ValuationReportSectionBodyKind.FrozenText),
        new(27, ValuationReportSectionKeys.Glossary, "المصطلحات", ValuationReportSectionBodyKind.FrozenText),
    ];

 /// <summary>
 /// Visible sections for a report instance. Building-only content is folded into
 /// existing slots (e.g. utilities label); approach tables drop when unused.
 /// </summary>
    public static IReadOnlyList<ValuationReportSectionDefinition> ResolveVisible(
        bool hasStructuresToValue,
        bool marketApproachUsed,
        bool costApproachUsed,
        bool incomeApproachUsed = false)
    {
        return All
            .Where(s => IsIncluded(s, hasStructuresToValue, marketApproachUsed, costApproachUsed, incomeApproachUsed))
            .ToList();
    }

    public static bool IsIncluded(
        ValuationReportSectionDefinition section,
        bool hasStructuresToValue,
        bool marketApproachUsed,
        bool costApproachUsed,
        bool incomeApproachUsed = false)
    {
        if (section.BuildingOnly && !hasStructuresToValue) return false;
        if (section.RequiresMarketApproach && !marketApproachUsed) return false;
        if (section.RequiresCostApproach && !costApproachUsed) return false;
        if (section.RequiresIncomeApproach && !incomeApproachUsed) return false;
        return true;
    }

 /// <summary>Section 9 title: land uses area utilities; buildings use full services.</summary>
    public static string DisplayTitleAr(ValuationReportSectionDefinition section, bool hasStructuresToValue)
    {
        if (section.Key == ValuationReportSectionKeys.AreaUtilities && hasStructuresToValue)
            return "الخدمات والمرافق";
        return section.TitleAr;
    }

    public static string PhotoBudgetHint(bool hasStructuresToValue) =>
        hasStructuresToValue ? "حتى 12 صورة (6 بالصفحة)" : "حتى 6 صور (أرض)";
}

/// <summary>
/// Valuation report number — numbering workshop (bit item 3): unified pattern TQ-{year}-{5-digit seq}
/// for numbers issued after activation; numbers frozen in Q-6 snapshots never change.
/// </summary>
public static class ValuationReportNumberRules
{
    /// <summary>Format: TQ-{yyyy}-{#####} (e.g. TQ-2026-00012).</summary>
    public static string FormatIssued(DateOnly reportDate, int ordinal)
    {
        var n = ordinal < 1 ? 1 : ordinal;
        return ReferenceNumbering.Format(ReferenceNumbering.ValuationReport, reportDate.Year, n);
    }

    /// <summary>
    /// Preview number before issuance: same TQ date stamp, ordinal from display-id digits.
    /// </summary>
    public static string FormatTemporary(string displayId, DateOnly reportDate)
    {
        var digits = new string((displayId ?? "").Where(char.IsDigit).ToArray());
        var ordinal = int.TryParse(digits, out var n) && n > 0 ? n : 1;
        return FormatIssued(reportDate, ordinal);
    }

    /// <summary>
    /// Number reserved when the appraisal task is spawned. Uses the request
    /// (distribution) date so the TQ stamp does not change at later preview.
    /// </summary>
    public static string FormatReserved(string displayId, DateOnly reservedDate) =>
        FormatTemporary(displayId, reservedDate);
}

/// <summary>report validity: 90 days from the report date. Advisory control, not a hard gate.</summary>
public static class ValuationReportValidityRules
{
    public const int ValidityDays = 90;

    public static DateOnly ValidUntil(DateOnly reportDate) =>
        reportDate.AddDays(ValidityDays);

    public static string NoteAr(DateOnly reportDate) =>
        "صلاحية التقرير " + ValidityDays + " يومًا من تاريخه — حتى "
        + ValuationReportDisplayRules.FormatGregorianDate(ValidUntil(reportDate))
        + " (ضابط تنبيهي لا حاجب).";
}

/// <summary>Display-layer helpers — scaffold only.</summary>
public static class ValuationReportDisplayRules
{
    public static string FormatGregorianDate(DateOnly date) =>
        $"{date.Year:D4}/{date.Month:D2}/{date.Day:D2}";

 /// <summary>Hijri display — Um Al-Qura calendar (the Kingdom's official one), "AH" suffix.</summary>
    public static string FormatHijriDate(DateOnly date)
    {
        var hijri = new System.Globalization.UmAlQuraCalendar();
        var dt = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return $"{hijri.GetYear(dt):D4}/{hijri.GetMonth(dt):D2}/{hijri.GetDayOfMonth(dt):D2}هـ";
    }

 /// <summary>Formats an ISO yyyy-MM-dd (or ISO datetime) string as YYYY/MM/DD; falls back to input.</summary>
    public static string FormatIsoDateString(string? iso)
    {
        var s = (iso ?? "").Trim();
        if (s.Length == 0) return "";
        if (DateOnly.TryParse(s.Length >= 10 ? s[..10] : s, out var d))
            return FormatGregorianDate(d);
        return s;
    }

    public static string FormatMoney(decimal amount) =>
        amount.ToString("#,##0.00", System.Globalization.CultureInfo.InvariantCulture);

 /// <summary>Plain Arabic valuer word (al-muqayyim) without tashkeel in body copy.</summary>
    public const string ValuerWordPlain = "المقيم";
}
