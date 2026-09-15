using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Platform.Application.Rules;

/// <summary>
/// Staff account ↔ valuers roster: a new «مقيم عقاري» account gets a linked row;
/// professional Taqeem fields stay on the roster screen. Pure list transform.
/// </summary>
public static class StaffValuerRosterSyncRules
{
    public const string UpsertMode = "upsert";
    public const string DeactivateMode = "deactivate";
    public const string WorkingValuerRole = "valuer";

    public static bool IsUpsert(string? mode) =>
        string.Equals(mode?.Trim(), UpsertMode, StringComparison.OrdinalIgnoreCase);

    public static List<OrganizationValuerRosterEntryDto> Apply(
        IReadOnlyList<OrganizationValuerRosterEntryDto> valuers,
        string userId,
        string displayName,
        bool upsert)
    {
        var id = (userId ?? "").Trim();
        var name = (displayName ?? "").Trim();
        if (id.Length == 0) return valuers.Select(v => Clone(v)).ToList();

        var next = valuers.Select(v => Clone(v)).ToList();
        var index = next.FindIndex(v => StaffIdMatch(v.StaffUserId, id));
        if (index < 0 && upsert && name.Length > 0)
        {
            index = next.FindIndex(v =>
                string.IsNullOrWhiteSpace(v.StaffUserId)
                && !string.Equals(v.Role, "certified", StringComparison.OrdinalIgnoreCase)
                && PeopleNameMatch(v.NameAr, name));
        }

        // Certified (عماد) is never assigned or deactivated from staff-user create.
        if (index >= 0 && string.Equals(next[index].Role, "certified", StringComparison.OrdinalIgnoreCase))
            return next;

        if (upsert)
        {
            if (name.Length == 0) return next;
            if (index < 0)
            {
                next.Add(NewWorkingRow(id, name));
                return next;
            }

            var hit = next[index];
            next[index] = Clone(hit, name, id, isActive: true);
            return next;
        }

        if (index >= 0)
            next[index] = Clone(next[index], next[index].NameAr, id, isActive: false);
        return next;
    }

    public static bool PeopleNameMatch(string a, string b)
    {
        static string Norm(string s) =>
            string.Join(" ", s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        var left = Norm(a ?? "");
        var right = Norm(b ?? "");
        if (left.Length == 0 || right.Length == 0) return false;
        return left == right
            || left.Contains(right, StringComparison.Ordinal)
            || right.Contains(left, StringComparison.Ordinal);
    }

    static bool StaffIdMatch(string? stored, string userId) =>
        !string.IsNullOrWhiteSpace(stored)
        && string.Equals(stored.Trim(), userId, StringComparison.OrdinalIgnoreCase);

    static OrganizationValuerRosterEntryDto NewWorkingRow(string userId, string name) =>
        new()
        {
            Id = Guid.NewGuid().ToString("N"),
            NameAr = name,
            Role = WorkingValuerRole,
            IsActive = true,
            StaffUserId = userId,
        };

    static OrganizationValuerRosterEntryDto Clone(
        OrganizationValuerRosterEntryDto v,
        string? nameAr = null,
        string? staffUserId = null,
        bool? isActive = null) =>
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
            Role = v.Role,
            IsActive = isActive ?? v.IsActive,
            SignatureUrl = v.SignatureUrl,
            StaffUserId = staffUserId ?? v.StaffUserId,
        };
}
