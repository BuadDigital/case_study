using RealEstateEval.Domain;
namespace RealEstateEval.Financial.Domain;

/// <summary>
/// A specialist's proposed discount on a party fee, made when accepting the party's outputs. It
/// does not change money until a supervisor of the transaction's department decides it: approve
/// as proposed, amend the amount, or waive it so the full fee is paid.
/// </summary>
/// <remarks>
/// Lifecycle: created <see cref="DiscountFlagStatuses.Pending"/> by the acceptance (the task's
/// fee lines wait in sup-review at full amount) → closed by the supervisor's decision, which writes
/// <see cref="ResolvedDiscountSar"/> onto the lines and sends them to finance. Only one pending
/// proposal may exist per task (filtered unique index). A whole-transaction cancellation of the
/// party's fee closes any pending proposal as <see cref="DiscountFlagStatuses.Amended"/> with the
/// full fee as the resolved amount.
/// </remarks>
public class DiscountFlag : ITrackUpdatedAt
{
    public DateTime UpdatedAtUtc { get; set; }
    public Guid Id { get; set; }

 /// <summary>Work-order PO — the transaction key until introduces a dedicated id.</summary>
    public string TransactionKey { get; set; } = "";

    public Guid? WorkflowTaskId { get; set; }

 /// <summary>Distribution assignee whose fee is being flagged.</summary>
    public string TargetAssigneeId { get; set; } = "";

    public string FlaggedByUserId { get; set; } = "";
 /// <summary>Display name of the proposer, stamped so the supervisor sees who asked.</summary>
    public string? FlaggedByName { get; set; }
    public string Reason { get; set; } = "";

 /// <summary>Suggested discount amount. The supervisor may change it on decision.</summary>
    public decimal ProposedDiscountSar { get; set; }

 /// <summary>pending | approved | amended | waived</summary>
    public string Status { get; set; } = DiscountFlagStatuses.Pending;

    public string? ResolvedByUserId { get; set; }
 /// <summary>The discount the supervisor actually applied (zero when waived).</summary>
    public decimal? ResolvedDiscountSar { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
    public string? ResolutionNote { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}

/// <summary>
/// pending — waiting for the supervisor; approved — applied as proposed; amended — the supervisor
/// changed the amount (or cancelled the whole fee); waived — no discount, the full fee is paid.
/// </summary>
public static class DiscountFlagStatuses
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Amended = "amended";
    public const string Waived = "waived";

    public static readonly IReadOnlyList<string> All = [Pending, Approved, Amended, Waived];
}

/// <summary>The three supervisor decisions on a proposed discount.</summary>
public static class DiscountProposalDecisions
{
    public const string Approve = "approve";
    public const string Amend = "amend";
    public const string Waive = "waive";
}
