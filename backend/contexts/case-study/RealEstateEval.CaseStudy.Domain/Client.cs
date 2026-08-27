namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// Client registry — required before opening a work order (valuation spec c-1).
/// Not a login account; business entity for the client name and report users.
/// </summary>
public class Client
{
    public Guid Id { get; set; }
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
 /// <summary>National ID / commercial registration — optional discriminator.</summary>
    public string? IdentityNumber { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>Known seed ids — Infath assignment center and Nabr Real Estate.</summary>
public static class SeedClientIds
{
    public static readonly Guid InfathAssignmentCenter =
        Guid.Parse("a1000001-0000-4000-8000-000000000001");

    /// <summary>
    /// Infath sub-client that can also be selected as a direct client.
    /// </summary>
    public static readonly Guid NabrRealEstate =
        Guid.Parse("a1000001-0000-4000-8000-000000000002");
}
