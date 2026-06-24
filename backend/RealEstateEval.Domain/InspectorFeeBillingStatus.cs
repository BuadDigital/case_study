namespace RealEstateEval.Domain;

/// <summary>
/// Payment lifecycle for party fee rows (HTML proposal).
/// </summary>
public static class InspectorFeeBillingStatus
{
    public const string Draft = "draft";
    public const string SupReview = "sup-review";
    public const string AtFinance = "at-finance";
    public const string DisbReq = "disb-req";
    public const string Disbursed = "disbursed";
    public const string Returned = "returned";
    public const string Inquiry = "inquiry";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Draft,
        SupReview,
        AtFinance,
        DisbReq,
        Disbursed,
        Returned,
        Inquiry,
    };
}

public static class InspectorFeeReturnTo
{
    public const string Supervisor = "supervisor";
    public const string Office = "office";
}

public static class InspectorFeeActions
{
    /// <summary>Office — draft → sup-review (work must be submitted).</summary>
    public const string SubmitToSupervisor = "submit-to-supervisor";

    /// <summary>Supervisor — sup-review → at-finance.</summary>
    public const string ApproveToFinance = "approve-to-finance";

    /// <summary>Supervisor — returned (to supervisor) → at-finance.</summary>
    public const string ResendToFinance = "resend-to-finance";

    /// <summary>Supervisor — returned (to supervisor) → returned (to office).</summary>
    public const string ReturnToOffice = "return-to-office";

    /// <summary>Office batch — at-finance → disb-req.</summary>
    public const string CreateDisbursementRequest = "create-disbursement-request";

    /// <summary>Finance — disb-req → disbursed.</summary>
    public const string Disburse = "disburse";

    /// <summary>Finance — at-finance | disb-req → returned (to supervisor).</summary>
    public const string ReturnToSupervisor = "return-to-supervisor";

    /// <summary>Finance — at-finance | disb-req → inquiry (to office).</summary>
    public const string InquiryToOffice = "inquiry-to-office";
}
