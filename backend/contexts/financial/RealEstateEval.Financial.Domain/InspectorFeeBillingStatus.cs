namespace RealEstateEval.Financial.Domain;

/// <summary>
/// Payment lifecycle for party fee rows (HTML proposal).
/// </summary>
/// <remarks>
/// Engineering-office survey fees (ruling of 2026-10-26):
/// <list type="bullet">
/// <item>The specialist's acceptance of the outputs accrues the fee from the pricing table straight
/// to <see cref="AtFinance"/> — no supervisor step.</item>
/// <item>When the specialist proposes a discount at acceptance, the line waits in
/// <see cref="SupReview"/> at full amount with a pending <c>DiscountFlag</c> until the department
/// supervisor approves, amends or waives it; then it goes to <see cref="AtFinance"/>.</item>
/// <item>The office never approves or disputes a discount inside the system: the retired
/// <c>office-review</c> and <c>disputed</c> states (and their negotiation deadline) are gone. Older
/// lines in those states were turned into pending proposals by the
/// <c>EngineeringFeeDiscountProposals</c> migration.</item>
/// </list>
/// </remarks>
public static class InspectorFeeBillingStatus
{
    public const string Draft = "draft";
    public const string SupReview = "sup-review";
    public const string AtFinance = "at-finance";
 /// <summary>Ready for billing but deferred by accountant to a later cycle.</summary>
    public const string Deferred = "deferred";
 /// <summary>Included in an engineering-office billing statement (listed).</summary>
    public const string InStatement = "in-statement";
    public const string DisbReq = "disb-req";
    public const string Disbursed = "disbursed";
    public const string Returned = "returned";
    public const string Inquiry = "inquiry";
 /// <summary>
 /// Withheld by the supervisor. The amount stays on the row so the history survives, but the line
 /// is neither payable nor eligible for a statement until the suspension is lifted.
 /// </summary>
    public const string Suspended = "suspended";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Draft,
        SupReview,
        AtFinance,
        Deferred,
        InStatement,
        DisbReq,
        Disbursed,
        Returned,
        Inquiry,
        Suspended,
    };

 /// <summary>
 /// States a line can be withheld from. Once it joins a statement or a disbursement request the
 /// money is already committed elsewhere, so it must be pulled back through those paths first.
 /// </summary>
    public static readonly IReadOnlySet<string> Suspendable = new HashSet<string>(StringComparer.Ordinal)
    {
        Draft,
        SupReview,
        AtFinance,
        Deferred,
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

 /// <summary>Supervisor — a suspendable state → suspended (withhold the incentive).</summary>
    public const string Suspend = "suspend";

 /// <summary>Supervisor — suspended → the state it was withheld from.</summary>
    public const string LiftSuspension = "lift-suspension";
}
