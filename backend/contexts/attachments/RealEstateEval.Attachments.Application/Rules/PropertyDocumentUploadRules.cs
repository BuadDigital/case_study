using RealEstateEval.Domain;

namespace RealEstateEval.Attachments.Application.Rules;

/// <summary>
/// Outcome of resolving a property document's type. <see cref="Error"/> is non-null exactly
/// when the write must be rejected; otherwise the caller persists the remaining fields.
/// </summary>
public sealed record ResolvedDocumentType(
    string? Error,
    string? TypeKey,
    string? CustomLabel,
    string? CustomReason,
    string? ReviewStatus)
{
    public static readonly ResolvedDocumentType None = new(null, null, null, null, null);

    public static ResolvedDocumentType Reject(string error) => new(error, null, null, null, null);
}

/// <summary>
/// Document governance for property uploads. The documents-tab scope must name a registry type;
/// the older per-field scopes are classified by the field they were uploaded from; anything
/// outside the defined list needs a name and a reason and waits for review.
/// </summary>
public static class PropertyDocumentUploadRules
{
    public const int CustomLabelMinLength = 2;
    public const int CustomLabelMaxLength = 128;
    public const int CustomReasonMinLength = 10;
    public const int CustomReasonMaxLength = 512;
    public const int ReviewNoteMaxLength = 512;

    public static ResolvedDocumentType Resolve(
        string? scope,
        string? scopeKey,
        string? documentTypeKey,
        string? customLabel,
        string? customReason)
    {
        var normalizedScope = scope?.Trim() ?? "";
        var requested = NormalizeKey(documentTypeKey);

        if (normalizedScope == PropertyDocumentTypes.GovernedScope)
        {
            if (requested is null)
                return ResolvedDocumentType.Reject("اختر نوع المستند من قائمة المستندات المعرّفة");
            return ClassifyTabDocument(requested, customLabel, customReason);
        }

        var implied = PropertyDocumentTypes.FromScope(normalizedScope, scopeKey);
        if (implied is null)
        {
            return requested is null
                ? ResolvedDocumentType.None
                : ResolvedDocumentType.Reject("لا يُقبل نوع مستند لموضع الرفع هذا");
        }

        if (requested is not null && requested != implied.Key)
            return ResolvedDocumentType.Reject("نوع المستند لا يطابق موضع الرفع");

        return Classify(implied, customLabel, customReason);
    }

    /// <summary>
    /// Re-type an existing upload. Only documents-tab rows and «other documents» rows can move;
    /// a per-field upload (deed image, delegation letter…) keeps the type of its field.
    /// </summary>
    public static ResolvedDocumentType Reclassify(
        string? currentScope,
        string? documentTypeKey,
        string? customLabel,
        string? customReason)
    {
        var scope = currentScope?.Trim() ?? "";
        var unlisted = PropertyDocumentTypes.Find(PropertyDocumentTypes.UnlistedKey)!;
        if (scope != PropertyDocumentTypes.GovernedScope && !unlisted.LegacyScopes.Contains(scope))
            return ResolvedDocumentType.Reject("لا يمكن تغيير نوع مستند مرتبط بحقل محدد");

        var requested = NormalizeKey(documentTypeKey);
        if (requested is null)
            return ResolvedDocumentType.Reject("اختر نوع المستند من قائمة المستندات المعرّفة");
        return ClassifyTabDocument(requested, customLabel, customReason);
    }

    /// <summary>Returns the rejection message, or null when the review may be recorded.</summary>
    public static string? ValidateReview(string? documentTypeKey, string? decision, string? note)
    {
        if (NormalizeKey(documentTypeKey) != PropertyDocumentTypes.UnlistedKey)
            return "المراجعة للمستندات غير المعرّفة فقط";

        var normalizedDecision = NormalizeKey(decision);
        if (normalizedDecision is not (PropertyDocumentReviewStatuses.Approved or PropertyDocumentReviewStatuses.Rejected))
            return "قرار المراجعة يجب أن يكون اعتمادًا أو رفضًا";

        var trimmedNote = note?.Trim() ?? "";
        if (normalizedDecision == PropertyDocumentReviewStatuses.Rejected && trimmedNote.Length == 0)
            return "اكتب سبب رفض المستند";
        if (trimmedNote.Length > ReviewNoteMaxLength)
            return "ملاحظة المراجعة أطول من المسموح";

        return null;
    }

    public static string? NormalizeKey(string? value)
    {
        var trimmed = value?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static ResolvedDocumentType ClassifyTabDocument(
        string requested,
        string? customLabel,
        string? customReason)
    {
        var chosen = PropertyDocumentTypes.Find(requested);
        if (chosen is null)
            return ResolvedDocumentType.Reject("نوع المستند غير معرّف في النظام");
        if (!chosen.UploadableFromTab)
            return ResolvedDocumentType.Reject($"«{chosen.LabelAr}» يُرفع من شاشة الجهة المختصة");
        return Classify(chosen, customLabel, customReason);
    }

    private static ResolvedDocumentType Classify(
        PropertyDocumentType type,
        string? customLabel,
        string? customReason)
    {
        if (type.Key != PropertyDocumentTypes.UnlistedKey)
            return new ResolvedDocumentType(null, type.Key, null, null, null);

        var label = customLabel?.Trim() ?? "";
        var reason = customReason?.Trim() ?? "";
        if (label.Length < CustomLabelMinLength)
            return ResolvedDocumentType.Reject("اكتب اسم المستند غير المعرّف");
        if (label.Length > CustomLabelMaxLength)
            return ResolvedDocumentType.Reject("اسم المستند أطول من المسموح");
        if (reason.Length < CustomReasonMinLength)
            return ResolvedDocumentType.Reject("اذكر سبب رفع مستند غير معرّف (10 أحرف على الأقل)");
        if (reason.Length > CustomReasonMaxLength)
            return ResolvedDocumentType.Reject("سبب رفع المستند أطول من المسموح");

        return new ResolvedDocumentType(
            null,
            PropertyDocumentTypes.UnlistedKey,
            label,
            reason,
            PropertyDocumentReviewStatuses.Pending);
    }
}
