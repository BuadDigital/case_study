using System.Text.Json;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The pure rules of «إلغاء المعاملة»: which deeds may be cancelled, how a work order's deeds group
/// into whole transactions, the request validation and the Arabic texts.
/// </summary>
public static class TransactionCancellationRules
{
    /// <summary>The deed status a final failure («التعذّر النهائي») leaves on its deeds.</summary>
    public const string FinalFailureDeedStatusAr = "موقوف";

    public const int MaxNoteLength = 2000;

    public const string ForbiddenRequestAr = "طلب إلغاء المعاملة للأخصائي والمشرف فقط";
    public const string ForbiddenDecideAr = "اعتماد إلغاء المعاملة وإعادة تفعيلها للمشرف فقط";
    public const string RequestNotFoundAr = "طلب الإلغاء غير موجود";
    public const string PropertyNotFoundAr = "العقار غير موجود";
    public const string WorkOrderNotFoundAr = "أمر العمل غير موجود";
    public const string ScopeRequiredAr = "حدد المعاملة أو أمر العمل";
    public const string ReasonRequiredAr = "اختر سبب الإلغاء";
    public const string NoteRequiredAr = "اكتب ملاحظة الإلغاء";
    public const string NoteTooLongAr = "الملاحظة طويلة جداً";
    public const string ReactivationNoteRequiredAr = "اكتب سبب إعادة التفعيل";
    public const string NothingToCancelAr = "لا توجد معاملة قابلة للإلغاء";
    public const string NotPendingAr = "طلب الإلغاء ليس بانتظار القرار";
    public const string NotApprovedAr = "المعاملة ليست ملغاة";

    public const string DeedRemovedAr = "الصك محذوف";
    public const string DeedCancelledAr = "المعاملة ملغاة";
    public const string DeedHandedOverAr = "المعاملة مرفوعة على إنفاذ — لا تُلغى";
    public const string DeedFinalFailureAr = "المعاملة متعذّرة نهائياً";
    public const string DeedPendingAr = "عليها طلب إلغاء بانتظار المشرف";

    /// <summary>Why one deed cannot be cancelled now; null when it can.</summary>
    /// <remarks>
    /// How it works: checks in order — removed, already cancelled, handed over to Enfaz (which also
    /// covers «جاهز للفوترة»), final failure («موقوف»), already in a pending request.
    /// Edge cases: a removed deed is reported but callers skip it silently — it is no longer part of
    /// the transaction.
    /// </remarks>
    public static string? DeedBlockReasonAr(WorkOrderProperty deed, bool inPendingRequest)
    {
        if (deed.IsRemoved) return DeedRemovedAr;
        if (deed.IsCancelled) return DeedCancelledAr;
        if (deed.IsHandedOverToEnfaz || deed.IsBillingReady) return DeedHandedOverAr;
        if (string.Equals(deed.DeedStatus?.Trim(), FinalFailureDeedStatusAr, StringComparison.Ordinal))
            return DeedFinalFailureAr;
        if (inPendingRequest) return DeedPendingAr;
        return null;
    }

    /// <summary>
    /// Splits deeds into what a request cancels and what it leaves out — whole transactions only.
    /// </summary>
    /// <remarks>
    /// How it works: drops removed deeds, groups the rest by transaction; a transaction with any
    /// blocked deed goes entirely to <c>Excluded</c> (each deed carrying its own reason, or the
    /// blocking deed's reason when it has none), every other transaction goes to <c>Deeds</c>.
    /// Edge cases: a transaction is never cancelled in part — a linked deed already on Enfaz keeps
    /// its siblings live too. Order: work order, then deed number.
    /// </remarks>
    public static (IReadOnlyList<TransactionCancellationDeedDto> Deeds, IReadOnlyList<TransactionCancellationDeedDto> Excluded)
        Split(IEnumerable<WorkOrderProperty> deeds, IReadOnlySet<Guid> pendingDeedIds)
    {
        var cancellable = new List<TransactionCancellationDeedDto>();
        var excluded = new List<TransactionCancellationDeedDto>();
        var live = deeds.Where(d => !d.IsRemoved)
            .OrderBy(d => d.WorkOrder?.PoNumber ?? "", StringComparer.Ordinal)
            .ThenBy(d => d.DeedNumber, StringComparer.Ordinal);

        foreach (var transaction in live.GroupBy(d => d.TransactionId))
        {
            var reasons = transaction.ToDictionary(
                d => d.Id,
                d => DeedBlockReasonAr(d, pendingDeedIds.Contains(d.Id)));
            var firstReason = reasons.Values.FirstOrDefault(r => r is not null);
            foreach (var deed in transaction)
            {
                if (firstReason is null)
                    cancellable.Add(ToDeedDto(deed, null));
                else
                    excluded.Add(ToDeedDto(deed, reasons[deed.Id] ?? firstReason));
            }
        }

        return (cancellable, excluded);
    }

    /// <summary>The request's own validation; null when it is complete.</summary>
    public static string? ValidateRequest(RequestTransactionCancellationRequest request)
    {
        if (request.PropertyId is null && string.IsNullOrWhiteSpace(request.PoNumber))
            return ScopeRequiredAr;
        if (!TransactionCancellationReasons.IsValid(request.ReasonCode?.Trim()))
            return ReasonRequiredAr;
        return ValidateNote(request.Note, NoteRequiredAr);
    }

    public static string? ValidateNote(string? note, string requiredMessage)
    {
        var text = note?.Trim() ?? "";
        if (text.Length == 0) return requiredMessage;
        return text.Length > MaxNoteLength ? NoteTooLongAr : null;
    }

    public static string? ValidateOptionalNote(string? note) =>
        (note?.Trim().Length ?? 0) > MaxNoteLength ? NoteTooLongAr : null;

    public static TransactionCancellationDeedDto ToDeedDto(WorkOrderProperty deed, string? blockedReason) => new()
    {
        PropertyId = deed.Id,
        PoNumber = deed.WorkOrder?.PoNumber ?? "",
        DeedNumber = deed.DeedNumber,
        TransactionId = deed.TransactionId,
        TransactionNumber = deed.Transaction?.DisplayNumber ?? "",
        BlockedReason = blockedReason,
    };

    public static string SerializeDeedIds(IEnumerable<Guid> ids) =>
        JsonSerializer.Serialize(ids.Distinct().ToList());

    /// <summary>The deed ids stored on a request; a damaged value reads as none.</summary>
    public static IReadOnlyList<Guid> ParseDeedIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<Guid>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>The timeline / notification line: reason label, then the note.</summary>
    public static string ReasonLine(TransactionCancellation request)
    {
        var label = TransactionCancellationReasons.LabelAr(request.ReasonCode);
        return string.IsNullOrWhiteSpace(request.Note) ? label : $"{label} — {request.Note}";
    }
}
