using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

public static class InspectorFeeBillingRules
{
    public static bool IsEditableStatus(string? status) =>
        status is InspectorFeeBillingStatus.PreBilling or InspectorFeeBillingStatus.Returned;

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
        out string? error)
    {
        nextStatus = "";
        error = null;
        var actionKey = action.Trim().ToLowerInvariant();

        switch (actionKey)
        {
            case InspectorFeeActions.SubmitToFinance:
                if (currentStatus is InspectorFeeBillingStatus.PreBilling
                    or InspectorFeeBillingStatus.Returned)
                {
                    nextStatus = InspectorFeeBillingStatus.ReadyForBilling;
                    return true;
                }

                error = "لا يمكن إرسال الأتعاب للمالية من هذه الحالة.";
                return false;

            case InspectorFeeActions.Invoice:
                if (currentStatus == InspectorFeeBillingStatus.ReadyForBilling)
                {
                    nextStatus = InspectorFeeBillingStatus.Invoiced;
                    return true;
                }

                error = "لا يمكن إصدار الفاتورة إلا للأتعاب الجاهزة للفوترة.";
                return false;

            case InspectorFeeActions.RecordPayment:
                if (currentStatus == InspectorFeeBillingStatus.Invoiced)
                {
                    nextStatus = InspectorFeeBillingStatus.Paid;
                    return true;
                }

                error = "لا يمكن تسجيل التحصيل إلا للأتعاب المفوترة.";
                return false;

            case InspectorFeeActions.Return:
                if (currentStatus is InspectorFeeBillingStatus.ReadyForBilling
                    or InspectorFeeBillingStatus.Invoiced)
                {
                    nextStatus = InspectorFeeBillingStatus.Returned;
                    return true;
                }

                error = "لا يمكن الإرجاع من هذه الحالة.";
                return false;

            default:
                error = "إجراء غير معروف.";
                return false;
        }
    }

    public static string StatusLabel(string? status) => status switch
    {
        InspectorFeeBillingStatus.PreBilling => "قبل الفوترة",
        InspectorFeeBillingStatus.ReadyForBilling => "جاهزة للفوترة",
        InspectorFeeBillingStatus.Invoiced => "مفوترة",
        InspectorFeeBillingStatus.Paid => "مدفوعة",
        InspectorFeeBillingStatus.Returned => "مُرجعة باعتراض",
        _ => "—",
    };
}
