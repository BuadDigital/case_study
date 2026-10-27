using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Rules;

public static class InspectorFeeBillingRules
{
    /// <summary>
    /// States whose amount may still change (direct supervisor discount, exclusion, or a
    /// whole-transaction cancellation). Once a line joins a statement, is paid or is suspended, its
    /// money is committed elsewhere and must be pulled back through those paths first.
    /// </summary>
    /// <remarks>
    /// <c>office-review</c> and <c>disputed</c> were dropped from this list with the office loop.
    /// Note that a <c>sup-review</c> line with a pending proposal is editable by status, but the fee
    /// row reports it as not editable and the service refuses a direct discount on it — it is
    /// settled through the proposal decision instead.
    /// </remarks>
    public static bool IsEditableStatus(string? status) =>
        status is InspectorFeeBillingStatus.Draft
            or InspectorFeeBillingStatus.SupReview
            or InspectorFeeBillingStatus.AtFinance
            or InspectorFeeBillingStatus.Deferred
            or InspectorFeeBillingStatus.Returned
            or InspectorFeeBillingStatus.Inquiry;

    public static bool ValidateDiscount(decimal discount, string? reason, out string? error) =>
        ValidateDiscount(discount, reason, agreedFeeSar: null, out error);

    public static bool ValidateDiscount(
        decimal discount,
        string? reason,
        decimal? agreedFeeSar,
        out string? error)
    {
        if (discount < 0m)
        {
            error = "الحسم لا يكون سالباً.";
            return false;
        }

        if (agreedFeeSar is { } fee && discount > fee)
        {
            error = "الحسم لا يتجاوز الأتعاب المتفق عليها.";
            return false;
        }

        if (discount > 0 && string.IsNullOrWhiteSpace(reason))
        {
            error = "يجب إدخال سبب الحسم عند تطبيق حسم.";
            return false;
        }

        error = null;
        return true;
    }

    public static bool TryResolveTransition(
        string currentStatus,
        string action,
        out string nextStatus,
        out string? returnTo,
        out string? error,
        string? preSuspensionStatus = null)
    {
        nextStatus = "";
        returnTo = null;
        error = null;
        var actionKey = action.Trim().ToLowerInvariant();

        switch (actionKey)
        {
            case InspectorFeeActions.Suspend:
                if (InspectorFeeBillingStatus.Suspendable.Contains(currentStatus))
                {
                    nextStatus = InspectorFeeBillingStatus.Suspended;
                    returnTo = null;
                    return true;
                }

                error = "لا يمكن إيقاف البند من هذه الحالة — أخرجه من الكشف أو أمر الصرف أولاً.";
                return false;

            case InspectorFeeActions.LiftSuspension:
                if (currentStatus != InspectorFeeBillingStatus.Suspended)
                {
                    error = "لا يمكن رفع الإيقاف إلا عن بند موقوف.";
                    return false;
                }

 // Restore exactly where the line was withheld from: a draft must not be promoted to
 // finance just because it spent time suspended.
                nextStatus = InspectorFeeBillingStatus.Suspendable.Contains(preSuspensionStatus ?? "")
                    ? preSuspensionStatus!
                    : InspectorFeeBillingStatus.SupReview;
                returnTo = null;
                return true;

            case InspectorFeeActions.SubmitToSupervisor:
                if (currentStatus == InspectorFeeBillingStatus.Draft
                    || currentStatus == InspectorFeeBillingStatus.Returned
                    || currentStatus == InspectorFeeBillingStatus.Inquiry)
                {
                    nextStatus = InspectorFeeBillingStatus.SupReview;
                    returnTo = null;
                    return true;
                }

                error = "لا يمكن رفع الأتعاب للمشرف من هذه الحالة.";
                return false;

            case InspectorFeeActions.ApproveToFinance:
                if (currentStatus == InspectorFeeBillingStatus.SupReview)
                {
                    nextStatus = InspectorFeeBillingStatus.AtFinance;
                    returnTo = null;
                    return true;
                }

                error = "لا يمكن اعتماد الأتعاب إلا للمعاملات بانتظار الاعتماد.";
                return false;

            case InspectorFeeActions.ResendToFinance:
                if (currentStatus == InspectorFeeBillingStatus.Returned)
                {
                    nextStatus = InspectorFeeBillingStatus.AtFinance;
                    returnTo = null;
                    return true;
                }

                error = "لا يمكن إعادة الإرسال للمالية من هذه الحالة.";
                return false;

            case InspectorFeeActions.ReturnToOffice:
                if (currentStatus == InspectorFeeBillingStatus.Returned)
                {
                    nextStatus = InspectorFeeBillingStatus.Returned;
                    returnTo = InspectorFeeReturnTo.Office;
                    return true;
                }

                error = "لا يمكن إرجاع المعاملة للمكتب من هذه الحالة.";
                return false;

            case InspectorFeeActions.CreateDisbursementRequest:
                if (currentStatus == InspectorFeeBillingStatus.AtFinance)
                {
                    nextStatus = InspectorFeeBillingStatus.DisbReq;
                    returnTo = null;
                    return true;
                }

                error = "لا يمكن إنشاء أمر صرف إلا للمعاملات الجاهزة لدى المالية.";
                return false;

            case InspectorFeeActions.Disburse:
                if (currentStatus == InspectorFeeBillingStatus.DisbReq)
                {
                    nextStatus = InspectorFeeBillingStatus.Disbursed;
                    returnTo = null;
                    return true;
                }

                error = "لا يمكن الصرف إلا للمعاملات ضمن أمر صرف.";
                return false;

            case InspectorFeeActions.ReturnToSupervisor:
                if (currentStatus is InspectorFeeBillingStatus.AtFinance
                    or InspectorFeeBillingStatus.DisbReq)
                {
                    nextStatus = InspectorFeeBillingStatus.Returned;
                    returnTo = InspectorFeeReturnTo.Supervisor;
                    return true;
                }

                error = "لا يمكن الإرجاع للمشرف من هذه الحالة.";
                return false;

            case InspectorFeeActions.InquiryToOffice:
                if (currentStatus is InspectorFeeBillingStatus.AtFinance
                    or InspectorFeeBillingStatus.DisbReq)
                {
                    nextStatus = InspectorFeeBillingStatus.Inquiry;
                    returnTo = InspectorFeeReturnTo.Office;
                    return true;
                }

                error = "لا يمكن فتح استفسار من هذه الحالة.";
                return false;

            default:
                error = "إجراء غير معروف.";
                return false;
        }
    }

    public static string StatusLabel(string? status) => status switch
    {
        InspectorFeeBillingStatus.Draft => "مستحق",
        InspectorFeeBillingStatus.SupReview => "بانتظار اعتماد المشرف",
        InspectorFeeBillingStatus.AtFinance => "جاهز للفوترة",
        InspectorFeeBillingStatus.Deferred => "جاهز — مرحَّل",
        InspectorFeeBillingStatus.InStatement => "مدرج",
        InspectorFeeBillingStatus.DisbReq => "ضمن أمر صرف",
        InspectorFeeBillingStatus.Disbursed => "مفوترة / مدفوعة",
        InspectorFeeBillingStatus.Returned => "مُعاد للتعديل",
        InspectorFeeBillingStatus.Inquiry => "استفسار مفتوح",
        InspectorFeeBillingStatus.Suspended => "موقوف",
 // Retired office-approval states — still named in the audit history of older lines.
 // Edge case: without these two cases the history of a line that went through the old loop
 // would show «—» for those steps after the statuses were removed from the enum.
        "office-review" => "بانتظار موافقة المكتب",
        "disputed" => "خلاف تسعير",
        _ => "—",
    };

 /// <summary>Lines eligible for inclusion in an engineering billing statement.</summary>
    public static bool IsReadyForEngStatement(string? status) =>
        status is InspectorFeeBillingStatus.AtFinance
            or InspectorFeeBillingStatus.Deferred;

    public static string WorkStatusLabel(string workStatus) => workStatus switch
    {
        InspectorFeeWorkStatuses.Done => "مكتملة",
        InspectorFeeWorkStatuses.Cancelled => "ملغاة",
        _ => "قيد التنفيذ",
    };
}
