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
    /// Unlock informal settlement via map URL: specialist or field inspector
    /// (plus supervisor / CDO). Engineering office waits — no write.
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

    public static bool InformalAccessUnlocked(string? planNumber, string? plotNumber, string? locationMapUrl)
    {
        if (!IsInformalSettlement(planNumber, plotNumber)) return true;
        return HasLocationMapUrl(locationMapUrl);
    }

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
    /// </summary>
    public static string? SurveyWorkBlockReason(
        bool bypass,
        bool inspectionCompleted,
        bool hasActiveFailure,
        bool informalUnlocked)
    {
        if (bypass) return null;
        if (hasActiveFailure)
            return "الرفع المساحي مجمّد بسبب تعذر نشط على العقار.";
        if (!inspectionCompleted)
            return "لا يمكن بدء الرفع المساحي قبل اكتمال المعاينة الميدانية.";
        if (!informalUnlocked)
            return "العقار في منطقة عشوائية — يلزم رابط موقع (خريطة) من الأخصائي أو المعاين.";
        return null;
    }

    public static string? InspectorSubmitKeyBlockReason(
        bool bypass,
        bool vacantLand,
        bool keyAvailable)
    {
        if (bypass || vacantLand) return null;
        if (!keyAvailable)
            return "لا يمكن إتمام المعاينة بدون استلام المفتاح (ما عدا الأرض الفضاء). سجّل تعذراً مع ملاحظة.";
        return null;
    }

    public static string? InformalAccessBlockReason(
        bool bypass,
        string? planNumber,
        string? plotNumber,
        string? locationMapUrl)
    {
        if (bypass) return null;
        if (InformalAccessUnlocked(planNumber, plotNumber, locationMapUrl)) return null;
        return "العقار في منطقة عشوائية — يلزم رابط موقع (خريطة) قبل الوصول.";
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

    public static Dictionary<string, string> GovernmentReviewSubmitFieldErrors(
        bool bypass,
        string? deedNumber,
        string? requestNumber,
        string? city,
        string? district,
        string? circuit,
        string? poNumber,
        string? assignmentMandateNumber,
        string? assignmentMandateDate)
    {
        var errors = new Dictionary<string, string>();
        if (bypass) return errors;

        foreach (var (key, message) in MissingGovernmentReviewBasics(
                     deedNumber,
                     requestNumber,
                     city,
                     district,
                     circuit,
                     poNumber,
                     assignmentMandateNumber,
                     assignmentMandateDate,
                     forSubmit: true))
        {
            errors[key] = message;
        }

        return errors;
    }

    /// <summary>
    /// Blocks assigning government-review if property basics are incomplete.
    /// </summary>
    public static string? GovernmentReviewAssignmentBlockReason(
        string? deedNumber,
        string? requestNumber,
        string? city,
        string? district,
        string? circuit,
        string? poNumber,
        string? assignmentMandateNumber,
        string? assignmentMandateDate)
    {
        var missing = MissingGovernmentReviewBasics(
            deedNumber,
            requestNumber,
            city,
            district,
            circuit,
            poNumber,
            assignmentMandateNumber,
            assignmentMandateDate,
            forSubmit: false);
        if (missing.Count == 0) return null;

        var labels = string.Join("، ", missing.Select(kv => kv.Value));
        return
            "لا يمكن إرسال المعاملة للمراجع الحكومي قبل اكتمال البيانات الأساسية: "
            + labels;
    }

    static List<KeyValuePair<string, string>> MissingGovernmentReviewBasics(
        string? deedNumber,
        string? requestNumber,
        string? city,
        string? district,
        string? circuit,
        string? poNumber,
        string? assignmentMandateNumber,
        string? assignmentMandateDate,
        bool forSubmit)
    {
        var missing = new List<KeyValuePair<string, string>>();

        void Require(string key, string? value, string submitMsg, string label)
        {
            if (!string.IsNullOrWhiteSpace(value)) return;
            missing.Add(new KeyValuePair<string, string>(
                key,
                forSubmit ? submitMsg : label));
        }

        Require("deedNumber", deedNumber, "رقم الصك مطلوب قبل تسليم المراجعة الحكومية.", "رقم الصك");
        Require("requestNumber", requestNumber, "رقم الطلب مطلوب قبل تسليم المراجعة الحكومية.", "رقم الطلب");
        Require("city", city, "المدينة مطلوبة قبل تسليم المراجعة الحكومية.", "المدينة");
        Require("district", district, "الحي مطلوب قبل تسليم المراجعة الحكومية.", "الحي");
        Require("circuit", circuit, "رقم الدائرة مطلوب قبل تسليم المراجعة الحكومية.", "الدائرة");
        Require("poNumber", poNumber, "رقم التعميد (PO) مطلوب قبل تسليم المراجعة الحكومية.", "رقم التعميد (PO)");
        Require("assignmentMandateNumber", assignmentMandateNumber, "رقم التكليف مطلوب قبل تسليم المراجعة الحكومية.", "رقم التكليف");
        Require("assignmentMandateDate", assignmentMandateDate, "تاريخ التكليف مطلوب قبل تسليم المراجعة الحكومية.", "تاريخ التكليف");

        return missing;
    }
}
