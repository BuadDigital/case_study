using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

public static class InspectorFeeBillingRules
{
    public static bool IsEditableStatus(string? status) =>
        status is InspectorFeeBillingStatus.Draft
            or InspectorFeeBillingStatus.SupReview
            or InspectorFeeBillingStatus.AtFinance
            or InspectorFeeBillingStatus.Returned
            or InspectorFeeBillingStatus.Inquiry;

    public static bool ValidateDiscount(decimal discount, string? reason, out string? error)
    {
        if (discount > 0 && string.IsNullOrWhiteSpace(reason))
        {
            error = "يجب إدخال سبب الحسم عند تطبيق خصم.";
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
        out string? error)
    {
        nextStatus = "";
        returnTo = null;
        error = null;
        var actionKey = action.Trim().ToLowerInvariant();

        switch (actionKey)
        {
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
        InspectorFeeBillingStatus.Draft => "مسودة لدى المكتب",
        InspectorFeeBillingStatus.SupReview => "بانتظار اعتماد المشرف",
        InspectorFeeBillingStatus.AtFinance => "جاهز للصرف (لدى المالية)",
        InspectorFeeBillingStatus.DisbReq => "ضمن أمر صرف",
        InspectorFeeBillingStatus.Disbursed => "مصروف",
        InspectorFeeBillingStatus.Returned => "مُعاد للتعديل",
        InspectorFeeBillingStatus.Inquiry => "استفسار مفتوح",
        _ => "—",
    };

    public static string WorkStatusLabel(string workStatus) => workStatus switch
    {
        "done" => "مكتملة",
        "cancelled" => "ملغاة",
        _ => "قيد التنفيذ",
    };
}
