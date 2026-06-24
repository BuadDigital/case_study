namespace RealEstateEval.Domain;

public static class InspectorFeeBillingStatus
{
    public const string PreBilling = "pre-billing";
    public const string ReadyForBilling = "ready-for-billing";
    public const string Invoiced = "invoiced";
    public const string Paid = "paid";
    public const string Returned = "returned";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        PreBilling,
        ReadyForBilling,
        Invoiced,
        Paid,
        Returned,
    };
}

public static class InspectorFeeActions
{
    public const string SubmitToFinance = "submit-to-finance";
    public const string Invoice = "invoice";
    public const string RecordPayment = "record-payment";
    public const string Return = "return";
}
