using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Platform.Application.Rules;

/// <summary>
/// The professional data a staff account carries into the valuers roster: its report role
/// (<c>none</c> hides it from the report) and the Taqeem credentials. A null member leaves the
/// stored value alone; an empty string clears it.
/// </summary>
public sealed record StaffValuerProfessional(
    string? ReportRole,
    string? MembershipCategory,
    string? MembershipNumber,
    string? MembershipExpiresAt,
    string? LicenseNumber,
    string? LicenseIssuedAt,
    string? LicenseExpiresAt,
    string? SignatureUrl,
    string? LinkRosterRowId = null);

/// <summary>
/// Staff account ↔ valuers roster: the users screen is the only place a person is added, and
/// the roster row linked to the account carries the professional data. Pure list transform.
/// </summary>
public static class StaffValuerRosterSyncRules
{
    public const string UpsertMode = "upsert";
    public const string DeactivateMode = "deactivate";
    public const string WorkingValuerRole = "valuer";
    public const string NoReportRole = "none";

    /// <summary>Report roles the users screen may assign; the certified role is chosen in بيانات المنشأة.</summary>
    public static readonly string[] AssignableReportRoles = ["valuer", "reviewer", "assistant"];

    public static bool IsUpsert(string? mode) =>
        string.Equals(mode?.Trim(), UpsertMode, StringComparison.OrdinalIgnoreCase);

    public static bool IsAssignableReportRole(string? role) =>
        AssignableReportRoles.Contains((role ?? "").Trim(), StringComparer.OrdinalIgnoreCase);

    public static List<OrganizationValuerRosterEntryDto> Apply(
        IReadOnlyList<OrganizationValuerRosterEntryDto> valuers,
        string userId,
        string displayName,
        bool upsert,
        StaffValuerProfessional? professional = null)
    {
        var id = (userId ?? "").Trim();
        var name = (displayName ?? "").Trim();
        if (id.Length == 0) return valuers.Select(v => Clone(v)).ToList();

        var next = valuers.Select(v => Clone(v)).ToList();
        var index = next.FindIndex(v => StaffIdMatch(v.StaffUserId, id));
        var linkId = (professional?.LinkRosterRowId ?? "").Trim();
        if (index < 0 && upsert && linkId.Length > 0)
        {
            // The users screen named the row to claim; a row that already belongs to another account stays theirs.
            index = next.FindIndex(v =>
                string.Equals(v.Id, linkId, StringComparison.OrdinalIgnoreCase)
                && string.IsNullOrWhiteSpace(v.StaffUserId));
        }
        if (index < 0 && upsert && name.Length > 0)
        {
            // An unlinked row with the same person's name is claimed, not duplicated. The
            // certified row is claimed only on an exact name, never on a partial match.
            index = next.FindIndex(v =>
                string.IsNullOrWhiteSpace(v.StaffUserId)
                && (CertifiedValuerRules.IsCertified(v)
                    ? SameName(v.NameAr, name)
                    : PeopleNameMatch(v.NameAr, name)));
        }

        var reportRole = (professional?.ReportRole ?? "").Trim().ToLowerInvariant();
        var hideFromReport = reportRole == NoReportRole;

        if (upsert)
        {
            if (name.Length == 0) return next;
            if (index < 0)
            {
                if (hideFromReport) return next;
                var role = IsAssignableReportRole(reportRole) ? reportRole : WorkingValuerRole;
                next.Add(WithProfessional(NewWorkingRow(id, name, role), professional));
                return next;
            }

            var hit = next[index];
            var certified = CertifiedValuerRules.IsCertified(hit);
            var nextRole = certified
                ? hit.Role
                : IsAssignableReportRole(reportRole) ? reportRole : hit.Role;
            // «لا يظهر» on a non-certified row hides it from the report; the certified row keeps
            // its seat until بيانات المنشأة names another, so it stays active.
            var active = certified || !hideFromReport;
            next[index] = WithProfessional(
                Clone(hit, name, id, isActive: active, role: nextRole),
                professional);
            return next;
        }

        if (index >= 0)
            next[index] = Clone(next[index], next[index].NameAr, id, isActive: false);
        return next;
    }

    public static bool PeopleNameMatch(string a, string b)
    {
        var left = Norm(a ?? "");
        var right = Norm(b ?? "");
        if (left.Length == 0 || right.Length == 0) return false;
        return left == right
            || left.Contains(right, StringComparison.Ordinal)
            || right.Contains(left, StringComparison.Ordinal);
    }

    static bool SameName(string a, string b)
    {
        var left = Norm(a ?? "");
        var right = Norm(b ?? "");
        return left.Length > 0 && left == right;
    }

    static string Norm(string s) =>
        string.Join(" ", s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    static bool StaffIdMatch(string? stored, string userId) =>
        !string.IsNullOrWhiteSpace(stored)
        && string.Equals(stored.Trim(), userId, StringComparison.OrdinalIgnoreCase);

    static OrganizationValuerRosterEntryDto NewWorkingRow(string userId, string name, string role) =>
        new()
        {
            Id = Guid.NewGuid().ToString("N"),
            NameAr = name,
            Role = role,
            IsActive = true,
            StaffUserId = userId,
        };

    /// <summary>Null keeps the stored value, blank clears it, anything else replaces it.</summary>
    static string? Pick(string? incoming, string? stored) =>
        incoming is null ? stored : (string.IsNullOrWhiteSpace(incoming) ? null : incoming.Trim());

    static OrganizationValuerRosterEntryDto WithProfessional(
        OrganizationValuerRosterEntryDto v,
        StaffValuerProfessional? p)
    {
        if (p is null) return v;
        return new()
        {
            Id = v.Id,
            NameAr = v.NameAr,
            LicenseNumber = Pick(p.LicenseNumber, v.LicenseNumber),
            MembershipNumber = Pick(p.MembershipNumber, v.MembershipNumber),
            MembershipCategory = Pick(p.MembershipCategory, v.MembershipCategory),
            LicenseExpiresAt = Pick(p.LicenseExpiresAt, v.LicenseExpiresAt),
            LicenseIssuedAt = Pick(p.LicenseIssuedAt, v.LicenseIssuedAt),
            MembershipExpiresAt = Pick(p.MembershipExpiresAt, v.MembershipExpiresAt),
            Role = v.Role,
            IsActive = v.IsActive,
            SignatureUrl = Pick(p.SignatureUrl, v.SignatureUrl),
            StaffUserId = v.StaffUserId,
        };
    }

    static OrganizationValuerRosterEntryDto Clone(
        OrganizationValuerRosterEntryDto v,
        string? nameAr = null,
        string? staffUserId = null,
        bool? isActive = null,
        string? role = null) =>
        new()
        {
            Id = v.Id,
            NameAr = nameAr ?? v.NameAr,
            LicenseNumber = v.LicenseNumber,
            MembershipNumber = v.MembershipNumber,
            MembershipCategory = v.MembershipCategory,
            LicenseExpiresAt = v.LicenseExpiresAt,
            LicenseIssuedAt = v.LicenseIssuedAt,
            MembershipExpiresAt = v.MembershipExpiresAt,
            Role = role ?? v.Role,
            IsActive = isActive ?? v.IsActive,
            SignatureUrl = v.SignatureUrl,
            StaffUserId = staffUserId ?? v.StaffUserId,
        };
}
