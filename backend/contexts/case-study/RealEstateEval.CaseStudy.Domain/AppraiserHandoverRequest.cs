using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// The appraiser hands a transaction on without reassigning it himself (Omar 2026-11-18). Two kinds:
/// <list type="bullet">
/// <item><see cref="AppraiserHandoverKinds.Reassign"/>: he asks whoever handed him the transaction (the
/// study specialist during the valuation work, the reviewer during the draft approval) to give it to
/// another appraiser. That person has it alone for a few working minutes, then the whole team of that
/// sub-role; the first to take it handles it. It never goes back to the appraiser on its own.</item>
/// <item><see cref="AppraiserHandoverKinds.Peer"/>: a transfer between two appraisers by mutual consent —
/// he offers his transaction to a colleague, or asks a colleague for his; it moves when the other one
/// accepts.</item>
/// </list>
/// One open request per appraisal task.
/// </summary>
public class AppraiserHandoverRequest : ITrackUpdatedAt
{
    public Guid Id { get; set; }

    /// <summary><see cref="AppraiserHandoverKinds"/>.</summary>
    public string Kind { get; set; } = AppraiserHandoverKinds.Reassign;

    /// <summary><see cref="AppraiserHandoverStatuses"/>.</summary>
    public string Status { get; set; } = AppraiserHandoverStatuses.Pending;

    public Guid AppraisalTaskId { get; set; }
    public Guid? PropertyId { get; set; }
    public string PoNumber { get; set; } = "";

    /// <summary>Reason (required for a reassignment request, optional for a peer transfer).</summary>
    public string Reason { get; set; } = "";

    public string RequestedByUserId { get; set; } = "";
    public string RequestedByName { get; set; } = "";
    /// <summary>The requesting appraiser's distribution id (who holds the seat, or who asks for it).</summary>
    public string RequestedByAssigneeId { get; set; } = "";
    public DateTime RequestedAtUtc { get; set; }

    /// <summary>Reassign: the sub-role that handles it («study» or «review»).</summary>
    public string? HandlerSubRole { get; set; }

    /// <summary>Reassign: the person who handed the transaction over — he has it alone first.</summary>
    public string? HandingUserId { get; set; }

    /// <summary>Reassign: when the request widened to the whole team (null while the handing person has it alone).</summary>
    public DateTime? EscalatedAtUtc { get; set; }

    /// <summary>The working day (Riyadh) whose end-of-day reminder was sent — one per day.</summary>
    public DateOnly? RemindedOn { get; set; }

    /// <summary>Reassign: who took it (the first to take it handles it).</summary>
    public string? TakenByUserId { get; set; }
    public string? TakenByName { get; set; }
    public DateTime? TakenAtUtc { get; set; }

    /// <summary>
    /// Peer: the other appraiser's distribution id — the colleague offered the transaction (offer) or the
    /// colleague who holds it (ask).
    /// </summary>
    public string? PeerAssigneeId { get; set; }
    public string? PeerName { get; set; }

    /// <summary>Peer: <see cref="AppraiserHandoverDirections"/>.</summary>
    public string? Direction { get; set; }

    public string? ClosedByUserId { get; set; }
    public string? ClosedByName { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public string? ClosingNote { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public bool IsOpen => Status is AppraiserHandoverStatuses.Pending or AppraiserHandoverStatuses.Taken;

    /// <summary>A reassignment request to whoever handed the transaction over.</summary>
    public static AppraiserHandoverRequest Reassign(
        Guid appraisalTaskId,
        Guid? propertyId,
        string poNumber,
        string reason,
        string requestedByUserId,
        string requestedByName,
        string requestedByAssigneeId,
        string handlerSubRole,
        string? handingUserId,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            Kind = AppraiserHandoverKinds.Reassign,
            AppraisalTaskId = appraisalTaskId,
            PropertyId = propertyId,
            PoNumber = poNumber.Trim(),
            Reason = reason.Trim(),
            RequestedByUserId = requestedByUserId.Trim(),
            RequestedByName = requestedByName.Trim(),
            RequestedByAssigneeId = requestedByAssigneeId.Trim(),
            RequestedAtUtc = nowUtc,
            HandlerSubRole = handlerSubRole,
            HandingUserId = Texts.NullIfBlank(handingUserId),
            // Nobody to have it alone: the team has it from the start.
            EscalatedAtUtc = string.IsNullOrWhiteSpace(handingUserId) ? nowUtc : null,
            UpdatedAtUtc = nowUtc,
        };

    /// <summary>A transfer between two appraisers, waiting for the other one's acceptance.</summary>
    public static AppraiserHandoverRequest Peer(
        Guid appraisalTaskId,
        Guid? propertyId,
        string poNumber,
        string direction,
        string? reason,
        string requestedByUserId,
        string requestedByName,
        string requestedByAssigneeId,
        string peerAssigneeId,
        string? peerName,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            Kind = AppraiserHandoverKinds.Peer,
            AppraisalTaskId = appraisalTaskId,
            PropertyId = propertyId,
            PoNumber = poNumber.Trim(),
            Direction = direction,
            Reason = (reason ?? "").Trim(),
            RequestedByUserId = requestedByUserId.Trim(),
            RequestedByName = requestedByName.Trim(),
            RequestedByAssigneeId = requestedByAssigneeId.Trim(),
            RequestedAtUtc = nowUtc,
            PeerAssigneeId = peerAssigneeId.Trim(),
            PeerName = Texts.NullIfBlank(peerName),
            UpdatedAtUtc = nowUtc,
        };

    /// <summary>The appraiser who ends up with the transaction when a peer transfer is accepted.</summary>
    public string? PeerReceiverAssigneeId =>
        Direction == AppraiserHandoverDirections.Offer ? PeerAssigneeId : RequestedByAssigneeId;

    /// <summary>The appraiser whose acceptance a peer transfer waits for.</summary>
    public string? PeerAcceptorAssigneeId => PeerAssigneeId;

    /// <summary>Widens a reassignment request to the team. Returns whether it changed.</summary>
    public bool TryEscalate(DateTime nowUtc)
    {
        if (Status != AppraiserHandoverStatuses.Pending || EscalatedAtUtc is not null) return false;
        EscalatedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        return true;
    }

    /// <summary>
    /// A specialist takes a reassignment request. Returns whether it changed.
    /// </summary>
    /// <remarks>
    /// Edge cases: only a pending reassignment is taken, once — the first to take it handles it; a second
    /// taker gets false. Taking it also widens nothing further (it is no longer pending).
    /// </remarks>
    public bool TryTake(string userId, string userName, DateTime nowUtc)
    {
        if (Kind != AppraiserHandoverKinds.Reassign || Status != AppraiserHandoverStatuses.Pending) return false;
        Status = AppraiserHandoverStatuses.Taken;
        TakenByUserId = userId.Trim();
        TakenByName = userName.Trim();
        TakenAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        return true;
    }

    /// <summary>Closes an open request as done, declined or cancelled. Returns whether it changed.</summary>
    public bool TryClose(string status, string userId, string userName, string? note, DateTime nowUtc)
    {
        if (!IsOpen) return false;
        Status = status;
        ClosedByUserId = userId.Trim();
        ClosedByName = userName.Trim();
        ClosedAtUtc = nowUtc;
        ClosingNote = Texts.NullIfBlank(note);
        UpdatedAtUtc = nowUtc;
        return true;
    }
}

public static class AppraiserHandoverKinds
{
    public const string Reassign = "reassign";
    public const string Peer = "peer";

    public static readonly IReadOnlyList<string> All = [Reassign, Peer];
}

public static class AppraiserHandoverDirections
{
    /// <summary>The appraiser offers his transaction to a colleague.</summary>
    public const string Offer = "offer";

    /// <summary>The appraiser asks a colleague for the colleague's transaction.</summary>
    public const string Ask = "ask";
}

public static class AppraiserHandoverStatuses
{
    public const string Pending = "pending";
    public const string Taken = "taken";
    public const string Done = "done";
    public const string Declined = "declined";
    public const string Cancelled = "cancelled";

    public static readonly IReadOnlyList<string> All = [Pending, Taken, Done, Declined, Cancelled];
}
