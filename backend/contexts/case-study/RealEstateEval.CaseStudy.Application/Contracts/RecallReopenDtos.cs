namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// Trusted valuation→case-study call: the case specialist approved an appraiser's recall, so
/// the appraiser's submitted package goes back to him. <see cref="Reason"/> is the appraiser's
/// own recall reason and becomes the return note.
/// </summary>
public class ReopenForRecallRequest
{
    public string? Reason { get; set; }
}

/// <summary>
/// Trusted valuation→case-study call: a deposited valuation report is reopened as a new version (n+1) by the
/// case specialist, so the appraiser's submitted package goes back to him and his task opens again.
/// <see cref="Reason"/> is the specialist's reopen reason and becomes the return note.
/// </summary>
public class ReopenForNewVersionRequest
{
    public string? Reason { get; set; }
}
