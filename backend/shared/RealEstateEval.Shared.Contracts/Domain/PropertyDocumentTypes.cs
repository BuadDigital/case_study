namespace RealEstateEval.Domain;

/// <summary>Property types a document type applies to before any admin override.</summary>
public enum PropertyDocumentApplicability
{
    All,
    Built,
    Land,
}

/// <summary>
/// One governed property document type. Keys are fixed in code — upload rules, issuance
/// gates and report sections depend on them — while admins edit the label, requiredness
/// and applicability through the valuation <c>attachments</c> list.
/// </summary>
public sealed record PropertyDocumentType(
    string Key,
    string LabelAr,
    string Group,
    PropertyDocumentApplicability AppliesTo,
    bool DefaultRequired,
    bool UploadableFromTab,
    bool PdfOnly,
    string? CountsAs,
    IReadOnlyList<string> LegacyScopes)
{
    /// <summary>The requirement this document satisfies: its own key, or the key it counts as.</summary>
    public string RequirementKey => CountsAs ?? Key;

    /// <summary>Appears in the admin attachments list (requiredness / applicability are editable).</summary>
    public bool IsConfigurable =>
        Group is not (PropertyDocumentGroups.Photos or PropertyDocumentGroups.Outputs or PropertyDocumentGroups.Unlisted);
}

public static class PropertyDocumentGroups
{
    public const string Ownership = "ownership";
    public const string Assignment = "assignment";
    public const string Contracts = "contracts";
    public const string Engineering = "engineering";
    public const string Movables = "movables";
    public const string Photos = "photos";
    public const string Outputs = "outputs";
    public const string Unlisted = "unlisted";

    public static readonly string[] All =
        [Ownership, Assignment, Contracts, Engineering, Movables, Photos, Outputs, Unlisted];
}

/// <summary>Review state of a document uploaded outside the defined list.</summary>
public static class PropertyDocumentReviewStatuses
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Rejected = "rejected";

    public static readonly string[] All = [Pending, Approved, Rejected];
}

/// <summary>
/// The registry of documents the system recognises on a property. Mirrored by
/// <c>packages/app-shared/src/domain/property-documents/property-document-types.ts</c>;
/// both sides are checked against <c>docs/architecture/property-document-types.json</c>.
/// </summary>
public static class PropertyDocumentTypes
{
    /// <summary>Upload scope of the documents tab — every row must carry a registry type.</summary>
    public const string GovernedScope = "property-document";

    public const string UnlistedKey = "unlisted";

    private const string InspectionPhotoScope = "field-inspection-photo";
    private const string BuildingPermitPhotoRefSuffix = ":component:buildLicense";

    public static readonly IReadOnlyList<string> BuiltPropertyTypes =
        ["فيلا", "شقة", "عمارة", "محل تجاري", "مستودع"];

    public static readonly IReadOnlyList<string> LandPropertyTypes = ["أرض"];

    /// <summary>Free-text aliases admins used for "any built property" before the list was typed.</summary>
    private static readonly HashSet<string> BuiltAliases = new(StringComparer.Ordinal)
    {
        "مبني", "مبنى", "مباني", "مبانٍ", "مبان",
    };

    public static readonly IReadOnlyList<PropertyDocumentType> All =
    [
        T("deed", "صك الملكية", PropertyDocumentGroups.Ownership, required: true,
            legacyScopes: ["property-deed-ownership"]),
        T("bourse-deed", "صورة الصك من البورصة", PropertyDocumentGroups.Ownership, countsAs: "deed",
            legacyScopes: ["property-bourse-deed"]),
        T("real-estate-registry", "السجل العقاري", PropertyDocumentGroups.Ownership, countsAs: "deed",
            legacyScopes: ["property-registry"]),
        T("boundaries-document", "مستند الحدود", PropertyDocumentGroups.Ownership,
            legacyScopes: ["property-boundaries"]),

        T("assignment-letter", "خطاب الإسناد", PropertyDocumentGroups.Assignment,
            legacyScopes: ["property-decree"]),
        T("delegation-letter", "خطاب التفويض", PropertyDocumentGroups.Assignment,
            legacyScopes: ["property-delegation"]),
        T("owner-identity", "هوية المالك / الوكالة", PropertyDocumentGroups.Assignment),

        T("lease-contract", "عقد الإيجار", PropertyDocumentGroups.Contracts,
            appliesTo: PropertyDocumentApplicability.Built),

        T("survey", "التقرير المساحي", PropertyDocumentGroups.Engineering,
            appliesTo: PropertyDocumentApplicability.Land, required: true, fromTab: false, pdfOnly: true,
            legacyScopes: ["engineering-survey-report"]),
        T("site-letter", "خطاب إقرار صحة الموقع", PropertyDocumentGroups.Engineering,
            fromTab: false, pdfOnly: true, legacyScopes: ["engineering-site-letter"]),
        T("building-permit", "رخصة البناء", PropertyDocumentGroups.Engineering,
            appliesTo: PropertyDocumentApplicability.Built),
        T("zoning-sketch", "الكروكي التنظيمي", PropertyDocumentGroups.Engineering),
        T("completion-certificate", "شهادة إتمام البناء", PropertyDocumentGroups.Engineering,
            appliesTo: PropertyDocumentApplicability.Built),
        T("utility-bills", "فواتير الخدمات", PropertyDocumentGroups.Engineering,
            appliesTo: PropertyDocumentApplicability.Built),

        T("movables-inventory", "قائمة حصر المنقولات", PropertyDocumentGroups.Movables,
            appliesTo: PropertyDocumentApplicability.Built),
        T("movables-valuation-report", "تقرير تقييم المنقولات", PropertyDocumentGroups.Movables,
            appliesTo: PropertyDocumentApplicability.Built),

        T("inspection-photo", "صور المعاينة", PropertyDocumentGroups.Photos, fromTab: false,
            legacyScopes: [InspectionPhotoScope]),

        T("valuation-report", "تقرير التقييم", PropertyDocumentGroups.Outputs, fromTab: false, pdfOnly: true,
            legacyScopes: ["evaluator-report"]),
        T("deposit-certificate", "شهادة الإيداع", PropertyDocumentGroups.Outputs, fromTab: false,
            legacyScopes: ["evaluator-deposit-certificate"]),

        T(UnlistedKey, "مستند غير معرّف", PropertyDocumentGroups.Unlisted,
            legacyScopes: ["property-other"]),
    ];

    private static readonly Dictionary<string, PropertyDocumentType> ByKey =
        All.ToDictionary(t => t.Key, StringComparer.Ordinal);

    private static readonly Dictionary<string, PropertyDocumentType> ByLegacyScope =
        All.SelectMany(t => t.LegacyScopes.Select(scope => (scope, t)))
            .ToDictionary(x => x.scope, x => x.t, StringComparer.Ordinal);

    public static PropertyDocumentType? Find(string? key)
    {
        var normalized = key?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(normalized) ? null : ByKey.GetValueOrDefault(normalized);
    }

    /// <summary>
    /// The type implied by a pre-registry upload scope. The inspector's building-permit photo
    /// shares the inspection-photo scope and is told apart by its photo reference.
    /// </summary>
    public static PropertyDocumentType? FromScope(string? scope, string? scopeKey = null)
    {
        var s = scope?.Trim() ?? "";
        if (s.Length == 0) return null;
        if (s == InspectionPhotoScope
            && (scopeKey ?? "").Trim().EndsWith(BuildingPermitPhotoRefSuffix, StringComparison.Ordinal))
        {
            return ByKey["building-permit"];
        }

        return ByLegacyScope.GetValueOrDefault(s);
    }

    /// <summary>Stored type first, then the type the upload scope implies.</summary>
    public static PropertyDocumentType? Resolve(string? documentTypeKey, string? scope, string? scopeKey) =>
        Find(documentTypeKey) ?? FromScope(scope, scopeKey);

    public static IReadOnlyList<string> DefaultPropertyTypeKeys(PropertyDocumentType type) =>
        type.AppliesTo switch
        {
            PropertyDocumentApplicability.Built => BuiltPropertyTypes,
            PropertyDocumentApplicability.Land => LandPropertyTypes,
            _ => [],
        };

    /// <summary>Trims, drops «الكل», and expands the free-text "built" aliases to the real types.</summary>
    public static IReadOnlyList<string> NormalizePropertyTypeKeys(IEnumerable<string?> keys)
    {
        var result = new List<string>();
        foreach (var raw in keys)
        {
            var key = raw?.Trim() ?? "";
            if (key.Length == 0 || key == "الكل") continue;
            var expanded = BuiltAliases.Contains(key) ? BuiltPropertyTypes : [key];
            foreach (var value in expanded)
            {
                if (!result.Contains(value, StringComparer.Ordinal)) result.Add(value);
            }
        }

        return result;
    }

    private static PropertyDocumentType T(
        string key,
        string label,
        string group,
        PropertyDocumentApplicability appliesTo = PropertyDocumentApplicability.All,
        bool required = false,
        bool fromTab = true,
        bool pdfOnly = false,
        string? countsAs = null,
        string[]? legacyScopes = null) =>
        new(key, label, group, appliesTo, required, fromTab, pdfOnly, countsAs, legacyScopes ?? []);
}
