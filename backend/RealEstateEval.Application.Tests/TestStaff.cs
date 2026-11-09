using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Test shorthand for a <see cref="StaffActor"/>: a case specialist given no sub-roles holds all
/// three (the launch rule of 2026-11-02, so tests written before the split keep their meaning);
/// any other role holds none.
/// </summary>
internal static class TestStaff
{
    public static StaffActor Of(string? role, params string[] subRoles) =>
        new(
            role,
            subRoles.Length == 0
            && string.Equals(role?.Trim(), StaffRoleIds.CaseSpecialist, StringComparison.OrdinalIgnoreCase)
                ? CaseSpecialistSubRoles.All
                : subRoles);
}
