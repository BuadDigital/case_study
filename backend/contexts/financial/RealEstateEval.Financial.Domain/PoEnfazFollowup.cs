namespace RealEstateEval.Domain;

/// <summary>
/// Finance follow-up attempt on an Enfaz revenue PO (design: followups[] on REV_TX).
/// </summary>
public class PoEnfazFollowup
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public DateTime FollowedAtUtc { get; set; }
 /// <summary>call | email | portal | visit | other</summary>
    public string Channel { get; set; } = "call";
    public string Notes { get; set; } = "";
    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}

public static class PoEnfazFollowupChannel
{
    public const string Call = "call";
    public const string Email = "email";
    public const string Portal = "portal";
    public const string Visit = "visit";
    public const string Other = "other";
}
