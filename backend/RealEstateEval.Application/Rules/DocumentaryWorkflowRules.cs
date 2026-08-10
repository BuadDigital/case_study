using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Documentary-cycle gates shared by API submit paths.
/// Supervisor / CDO bypass via <paramref name="bypass"/>.
/// </summary>
public static class DocumentaryWorkflowRules
{
    public const string SystemRaiserRole = "النظام";

    public static bool RoleBypassesDocumentaryGates(string? prototypeRole)
    {
        if (string.IsNullOrWhiteSpace(prototypeRole)) return false;
        return prototypeRole.Equals("cdo", StringComparison.OrdinalIgnoreCase)
            || prototypeRole.Equals("section-supervisor", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Roles allowed to set location map URL on property (initial data / specialist path).
    /// </summary>
    public static bool RoleCanSetLocationMapUrl(string? prototypeRole)
    {
        if (string.IsNullOrWhiteSpace(prototypeRole)) return false;
        return prototypeRole.Equals("cdo", StringComparison.OrdinalIgnoreCase)
            || prototypeRole.Equals("section-supervisor", StringComparison.OrdinalIgnoreCase)
            || prototypeRole.Equals("case-specialist", StringComparison.OrdinalIgnoreCase)
            || prototypeRole.Equals("field-inspector", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>عشوائي = غياب رقم المخطط ورقم القطعة معاً (AND).</summary>
    public static bool IsInformalSettlement(string? planNumber, string? plotNumber) =>
        string.IsNullOrWhiteSpace(planNumber) && string.IsNullOrWhiteSpace(plotNumber);

    public static bool HasLocationMapUrl(string? locationMapUrl) =>
        !string.IsNullOrWhiteSpace(locationMapUrl)
        && Uri.TryCreate(locationMapUrl.Trim(), UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    public static bool HasAnyPartyPhone(IEnumerable<PropertyContact>? contacts)
    {
        if (contacts is null) return false;
        foreach (var c in contacts)
        {
            if (c.Phone.Count(char.IsDigit) >= 10) return true;
        }
        return false;
    }

    public static bool BoundariesUnavailable(string? boundariesAvailability) =>
        string.Equals(boundariesAvailability?.Trim(), "no", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Survey may be worked only after sibling inspection is completed,
    /// and while there is no active property failure (unless bypass).
    /// Informal map-URL gating was removed: assignments are filtered upstream.
    /// </summary>
    public static string? SurveyWorkBlockReason(
        bool bypass,
        bool inspectionCompleted,
        bool hasActiveFailure)
    {
        if (bypass) return null;
        if (hasActiveFailure)
            return "الرفع المساحي مجمّد بسبب تعذر نشط على العقار.";
        if (!inspectionCompleted)
            return "لا يمكن بدء الرفع المساحي قبل اكتمال المعاينة الميدانية.";
        return null;
    }

    /// <summary>
    /// Field-inspection submit no longer requires a key in hand.
    /// Key envelopes / court access remain informational and for other workflows.
    /// Always returns null (kept for call-site compatibility until cleaned up).
    /// </summary>
    public static string? InspectorSubmitKeyBlockReason(
        bool bypass,
        bool vacantLand,
        bool keyAvailable)
    {
        _ = (bypass, vacantLand, keyAvailable);
        return null;
    }

    public static string? DeclarationPhoneBlockReason(
        bool bypass,
        bool hasPhone,
        bool phoneWasPresentAtDeclaration)
    {
        if (bypass) return null;
        // Once declaration path started with a phone, clearing later does not re-lock.
        if (phoneWasPresentAtDeclaration) return null;
        if (hasPhone) return null;
        return "لا يمكن توقيع إقرار العميل بدون وسيلة اتصال (جوال) لأحد الأطراف.";
    }
}
