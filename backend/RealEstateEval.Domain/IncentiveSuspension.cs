namespace RealEstateEval.Domain;

/// <summary>
/// Withholds employee incentives for one user on one transaction (PO). Transaction-scoped;
/// <see cref="PeriodFrom"/> / <see cref="PeriodTo"/> are reserved for a later time-window mode.
/// Accrual still creates the ledger; <c>suspended</c> status carries the withhold into payables.
/// </summary>
public class IncentiveSuspension
{
    public Guid Id { get; set; }

 /// <summary>Identity user id of the incentive owner.</summary>
    public string UserId { get; set; } = "";

 /// <summary>Distribution assignee id mirrored from the user profile (ledger join key).</summary>
    public string AssigneeId { get; set; } = "";

 /// <summary>Transaction key — today the work-order PO number.</summary>
    public string TransactionKey { get; set; } = "";

    public string Reason { get; set; } = "";

    public DateOnly? PeriodFrom { get; set; }
    public DateOnly? PeriodTo { get; set; }

    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }

    public DateTime? LiftedAtUtc { get; set; }
    public string? LiftedByUserId { get; set; }

    public bool IsActive => LiftedAtUtc is null;
}
