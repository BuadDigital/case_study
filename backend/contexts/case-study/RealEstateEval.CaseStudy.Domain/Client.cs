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

/// <summary>
/// Which per-client field requirements a work order carries. Infath's default is
/// "require everything" — a named client (currently only Nabr) can override
/// individual fields. Not Enfath-specific: any future client exception (Enfath
/// field or otherwise) is added here, in this one struct, instead of an IsXClient
/// check re-implemented in every validator that cares about "is this field
/// required". Mirrors the frontend's ClientFieldPolicy in po-intake-assignment.ts.
/// </summary>
public readonly record struct ClientFieldPolicy(bool RequiresAssignmentDoc, bool RequiresOwnerName)
{
    public static readonly ClientFieldPolicy Default = new(RequiresAssignmentDoc: true, RequiresOwnerName: true);
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

    private readonly record struct ClientFieldPolicyOverride(
        bool? RequiresAssignmentDoc = null,
        bool? RequiresOwnerName = null);

    /// <summary>
    /// Nabr never gets a قرار إسناد letter (Infath assigns Nabr work directly) or a
    /// separate اسم مالك — add the next client's exceptions here, not as a new
    /// IsXClient check scattered through the validators.
    /// </summary>
    private static readonly Dictionary<Guid, ClientFieldPolicyOverride> ClientFieldPolicyOverrides = new()
    {
        [NabrRealEstate] = new ClientFieldPolicyOverride(RequiresAssignmentDoc: false, RequiresOwnerName: false),
    };

    /// <summary>
    /// Resolves the effective policy for a work order. Nabr work almost never sets Nabr
    /// as the primary client (it's Infath — Nabr is not a peer work-order client) — Nabr
    /// shows up as a report user instead, so every id in play is checked, not just the
    /// primary client.
    /// </summary>
    public static ClientFieldPolicy ClientFieldPolicyForClient(
        Guid? clientId,
        IEnumerable<Guid>? reportUserClientIds)
    {
        var policy = ClientFieldPolicy.Default;
        foreach (var id in RelevantClientIds(clientId, reportUserClientIds))
        {
            if (!ClientFieldPolicyOverrides.TryGetValue(id, out var o)) continue;
            policy = policy with
            {
                RequiresAssignmentDoc = o.RequiresAssignmentDoc ?? policy.RequiresAssignmentDoc,
                RequiresOwnerName = o.RequiresOwnerName ?? policy.RequiresOwnerName,
            };
        }
        return policy;
    }

    private static IEnumerable<Guid> RelevantClientIds(Guid? clientId, IEnumerable<Guid>? reportUserClientIds)
    {
        if (clientId is { } id) yield return id;
        foreach (var reportUserId in reportUserClientIds ?? [])
            yield return reportUserId;
    }
}
