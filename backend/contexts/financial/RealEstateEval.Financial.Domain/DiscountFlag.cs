namespace RealEstateEval.Financial.Domain;

/// <summary>
/// A specialist's proposed discount on a party fee. It does not change money until a supervisor
/// of the transaction's department approves it onto the ledger.
/// </summary>
public class DiscountFlag
{
    public Guid Id { get; set; }

 /// <summary>Work-order PO — the transaction key until introduces a dedicated id.</summary>
    public string TransactionKey { get; set; } = "";

    public Guid? WorkflowTaskId { get; set; }

 /// <summary>Distribution assignee whose fee is being flagged.</summary>
    public string TargetAssigneeId { get; set; } = "";

    public string FlaggedByUserId { get; set; } = "";
    public string Reason { get; set; } = "";

 /// <summary>Suggested discount amount. The supervisor may change it on approve.</summary>
    public decimal ProposedDiscountSar { get; set; }

 /// <summary>pending | approved | rejected</summary>
    public string Status { get; set; } = DiscountFlagStatuses.Pending;

    public string? ApprovedByUserId { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
    public string? ResolutionNote { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}

public static class DiscountFlagStatuses
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Rejected = "rejected";
}
