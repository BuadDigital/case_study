namespace RealEstateEval.Valuation.Domain;

/// <summary>What the appraiser decided a «مستند ذو قيمة» does to the valuation.</summary>
public static class ValueDocumentEffects
{
    /// <summary>An approach indicator the system does not produce itself — enters reconciliation.</summary>
    public const string Indicator = "indicator";

    /// <summary>
    /// An amount added to the property value after the liquidation discount (movables, machinery
    /// valued elsewhere): never weighted, never discounted.
    /// </summary>
    public const string Addition = "addition";

    public static readonly string[] All = [Indicator, Addition];
}

/// <summary>The three IVS approaches a document indicator may belong to.</summary>
public static class ValueDocumentApproachKeys
{
    public const string Market = "market";
    public const string Cost = "cost";
    public const string Income = "income";

    public static readonly string[] All = [Market, Cost, Income];

    public static bool IsKnown(string? key) =>
        All.Contains((key ?? "").Trim().ToLowerInvariant(), StringComparer.Ordinal);

    public static string LabelAr(string? key) =>
        (key ?? "").Trim().ToLowerInvariant() switch
        {
            Market => "أسلوب السوق",
            Cost => "أسلوب التكلفة",
            Income => "أسلوب الدخل",
            _ => "",
        };
}

/// <summary>
/// One «مستند ذو قيمة» the appraiser uses in a valuation. A document with no effect has no row.
/// The label is a snapshot of the document's name, so the report keeps it even if the
/// attachments service is unreachable.
/// </summary>
public class ValuationValueDocumentUse
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
    /// <summary>The attachment (type <c>valued-document</c>) — lives in the attachments context.</summary>
    public Guid AttachmentId { get; set; }
    public string DocumentLabel { get; set; } = "";
    /// <summary><see cref="ValueDocumentEffects"/>.</summary>
    public string Effect { get; set; } = ValueDocumentEffects.Addition;
    /// <summary><see cref="ValueDocumentApproachKeys"/> — indicators only.</summary>
    public string? ApproachKey { get; set; }
    /// <summary>The method as the appraiser names it (e.g. «الطريقة المتبقية») — indicators only.</summary>
    public string? MethodName { get; set; }
    public decimal Value { get; set; }
    public int SortOrder { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
}

/// <summary>One requested use, before it is validated and stored.</summary>
public sealed record ValueDocumentUseInput(
    Guid AttachmentId,
    string? Effect,
    string? ApproachKey,
    string? MethodName,
    decimal Value);

/// <summary>A valued document on the property, as the attachments context reports it.</summary>
public sealed record ValuedDocumentRef(Guid AttachmentId, string Label, string? Status);

public static class ValueDocumentUseRules
{
    public const int MethodNameMinLength = 2;
    public const int MethodNameMaxLength = 128;
    public const int DocumentLabelMaxLength = 128;

    /// <summary>Reconciliation kinds of document indicators: <c>doc:{attachmentId:N}</c>.</summary>
    public const string ReconciliationKindPrefix = "doc:";

    public static string ReconciliationKind(Guid attachmentId) =>
        ReconciliationKindPrefix + attachmentId.ToString("N");

    public static bool IsDocumentKind(string? kind) =>
        (kind ?? "").Trim().StartsWith(ReconciliationKindPrefix, StringComparison.OrdinalIgnoreCase);

    /// <summary>«أسلوب الدخل — الطريقة المتبقية (مستند)».</summary>
    public static string IndicatorLabelAr(string? approachKey, string? methodName) =>
        $"{ValueDocumentApproachKeys.LabelAr(approachKey)} — {(methodName ?? "").Trim()} (مستند)";

    public static bool IsIndicator(ValuationValueDocumentUse use) =>
        string.Equals(use.Effect, ValueDocumentEffects.Indicator, StringComparison.Ordinal);

    public static bool IsAddition(ValuationValueDocumentUse use) =>
        string.Equals(use.Effect, ValueDocumentEffects.Addition, StringComparison.Ordinal);

    /// <summary>
    /// Field errors (empty = valid). An indicator's approach must not be one the system already
    /// values internally; a method appears once within its approach; values are positive; every
    /// document is a valued document of this property and is used once.
    /// </summary>
    public static Dictionary<string, string> Validate(
        IReadOnlyList<ValueDocumentUseInput> uses,
        IReadOnlyCollection<string> internalApproachKinds,
        IReadOnlyCollection<ValuedDocumentRef> documentsOnProperty)
    {
        var errors = new Dictionary<string, string>();
        var known = documentsOnProperty.Select(d => d.AttachmentId).ToHashSet();
        var seenDocs = new HashSet<Guid>();
        var seenMethods = new HashSet<string>(StringComparer.Ordinal);

        for (var i = 0; i < uses.Count; i++)
        {
            var u = uses[i];
            var at = $"uses[{i}]";
            if (!known.Contains(u.AttachmentId))
                errors[$"{at}.attachmentId"] = "المستند ليس مستندًا ذا قيمة لهذا العقار";
            else if (!seenDocs.Add(u.AttachmentId))
                errors[$"{at}.attachmentId"] = "لا يُستخدم المستند أكثر من مرة";

            var effect = (u.Effect ?? "").Trim().ToLowerInvariant();
            if (!ValueDocumentEffects.All.Contains(effect, StringComparer.Ordinal))
            {
                errors[$"{at}.effect"] = "اختر أثر المستند";
                continue;
            }

            if (u.Value <= 0m)
                errors[$"{at}.value"] = "أدخل قيمة أكبر من صفر";

            if (effect != ValueDocumentEffects.Indicator) continue;

            var approach = (u.ApproachKey ?? "").Trim().ToLowerInvariant();
            if (!ValueDocumentApproachKeys.IsKnown(approach))
                errors[$"{at}.approachKey"] = "اختر الأسلوب";
            else if (internalApproachKinds.Contains(approach, StringComparer.OrdinalIgnoreCase))
                errors[$"{at}.approachKey"] =
                    $"{ValueDocumentApproachKeys.LabelAr(approach)} مستخدم داخليًا في هذا التقييم — لا يُضاف مؤشره من مستند";

            var method = (u.MethodName ?? "").Trim();
            if (method.Length < MethodNameMinLength)
                errors[$"{at}.methodName"] = "اكتب اسم الطريقة";
            else if (method.Length > MethodNameMaxLength)
                errors[$"{at}.methodName"] = "اسم الطريقة أطول من المسموح";
            else if (!seenMethods.Add(approach + "|" + NormalizeMethod(method)))
                errors[$"{at}.methodName"] = "هذه الطريقة مختارة من مستند آخر — كل طريقة تُختار مرة واحدة";
        }

        return errors;
    }

    /// <summary>
    /// Indicators whose approach has since been enabled internally — the report would then carry
    /// the same approach twice, so issuance stops until the appraiser resolves it.
    /// </summary>
    public static IReadOnlyList<ValuationValueDocumentUse> ConflictingIndicators(
        IEnumerable<ValuationValueDocumentUse> uses,
        IReadOnlyCollection<string> internalApproachKinds) =>
        uses.Where(u => IsIndicator(u)
                && internalApproachKinds.Contains(u.ApproachKey ?? "", StringComparer.OrdinalIgnoreCase))
            .ToList();

    private static string NormalizeMethod(string method) =>
        string.Join(' ', method.Split(' ', StringSplitOptions.RemoveEmptyEntries));
}
