using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Who is acting, as the role rules need it: the product role plus, for a case specialist, the
/// sub-roles he holds (coordination / study / review — Omar's ruling 2026-11-02).
/// </summary>
/// <remarks>
/// How it works: built from the caller's <see cref="PermissionsDto"/> (claims) by
/// <see cref="From"/>; <see cref="Holds"/> is true only for a case specialist carrying that
/// sub-role, so a supervisor or the CDO never "holds" one — their access stays in the role checks.
/// Edge cases: a null role or a null sub-role list holds nothing; sub-role words compare
/// case-insensitively after trimming.
/// </remarks>
public readonly record struct StaffActor(string? Role, IReadOnlyCollection<string>? SubRoles)
{
    public static StaffActor From(PermissionsDto? permissions) =>
        new(permissions?.PrototypeRole, permissions?.SubRoles);

    /// <summary>The role trimmed and lower-cased; "" when absent.</summary>
    public string NormalizedRole => Role?.Trim().ToLowerInvariant() ?? "";

    public bool IsCaseSpecialist => NormalizedRole == StaffRoleIds.CaseSpecialist;

    public bool Holds(string subRole) =>
        IsCaseSpecialist
        && SubRoles is not null
        && SubRoles.Any(s => string.Equals(s?.Trim(), subRole, StringComparison.OrdinalIgnoreCase));

    public bool HoldsCoordination => Holds(CaseSpecialistSubRoles.Coordination);

    public bool HoldsStudy => Holds(CaseSpecialistSubRoles.Study);

    public bool HoldsReview => Holds(CaseSpecialistSubRoles.Review);
}
