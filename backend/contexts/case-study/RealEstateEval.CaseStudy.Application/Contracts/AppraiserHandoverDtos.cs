namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>An appraiser's reassignment request or peer transfer, as the screens show it.</summary>
public sealed class AppraiserHandoverRequestDto
{
    public string Id { get; set; } = "";
    /// <summary>reassign | peer.</summary>
    public string Kind { get; set; } = "";
    /// <summary>pending | taken | done | declined | cancelled.</summary>
    public string Status { get; set; } = "";
    public string AppraisalTaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string PoNumber { get; set; } = "";
    public string Reason { get; set; } = "";
    public string RequestedByName { get; set; } = "";
    public string RequestedByAssigneeId { get; set; } = "";
    public string RequestedAtUtc { get; set; } = "";
    /// <summary>Reassign: study | review.</summary>
    public string? HandlerSubRole { get; set; }
    /// <summary>Reassign: the request reached the whole team.</summary>
    public bool Escalated { get; set; }
    public string? TakenByName { get; set; }
    public string? TakenAtUtc { get; set; }
    /// <summary>Peer: offer | ask.</summary>
    public string? Direction { get; set; }
    public string? PeerAssigneeId { get; set; }
    public string? PeerName { get; set; }
}

/// <summary>The appraiser asks whoever handed him the transaction to reassign it.</summary>
public sealed class RequestAppraiserReassignmentRequest
{
    public Guid AppraisalTaskId { get; set; }
    public string Reason { get; set; } = "";
}

/// <summary>A transfer between two appraisers: offer the caller's transaction, or ask for the colleague's.</summary>
public sealed class RequestPeerTransferRequest
{
    public Guid AppraisalTaskId { get; set; }
    /// <summary>offer | ask.</summary>
    public string Direction { get; set; } = "";
    /// <summary>The colleague's distribution id.</summary>
    public string PeerAssigneeId { get; set; } = "";
    public string? PeerName { get; set; }
    public string? Reason { get; set; }
}

/// <summary>The specialist who took a reassignment request hands the transaction to another appraiser.</summary>
public sealed class CompleteAppraiserReassignmentRequest
{
    public string NewAssigneeId { get; set; } = "";
    public string? NewAssigneeName { get; set; }
}

/// <summary>Optional note on a decline or a cancellation.</summary>
public sealed class CloseAppraiserHandoverRequest
{
    public string? Note { get; set; }
}
