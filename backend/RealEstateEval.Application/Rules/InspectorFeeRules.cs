namespace RealEstateEval.Application.Rules;

/// <summary>
/// Field-inspection party types and seed/fallback fees for cooperator rates.
/// Employee inspectors are outside the pricing table — agreed fee is entered manually.
/// Live cooperator defaults come from the active <c>PartyFeePricingTable</c>.
/// </summary>
public static class InspectorFeeRules
{
    public const string TypeEmployee = "موظف";
    public const string TypeCooperatorIndividual = "متعاون فرد";
    public const string TypeCooperatorOrganization = "متعاون شركة";
    /// <summary>Legacy label kept for older ledgers.</summary>
    public const string TypeCooperatorLegacy = "متعاون";

    public const decimal CooperatorIndividualFeeSar = 400m;
    public const decimal CooperatorOrganizationFeeSar = 500m;

    private static readonly HashSet<string> CooperatorAssigneeIds = new(StringComparer.Ordinal)
    {
        "fi-ahmed",
    };

    public static string ResolveInspectorType(string? assigneeId) =>
        assigneeId is not null && CooperatorAssigneeIds.Contains(assigneeId)
            ? TypeCooperatorIndividual
            : TypeEmployee;

    /// <summary>
    /// Seed/fallback for cooperator types only. Employees have no table default (returns 0).
    /// </summary>
    public static decimal DefaultAgreedFee(string inspectorType) =>
        inspectorType switch
        {
            TypeCooperatorOrganization => CooperatorOrganizationFeeSar,
            TypeCooperatorIndividual or TypeCooperatorLegacy => CooperatorIndividualFeeSar,
            _ => 0m,
        };

    public static bool IsEmployee(string? inspectorType) =>
        string.Equals(inspectorType, TypeEmployee, StringComparison.Ordinal);

    public static bool IsCooperator(string? inspectorType) =>
        inspectorType is TypeCooperatorIndividual
            or TypeCooperatorOrganization
            or TypeCooperatorLegacy;

    public static decimal NetFee(decimal agreedFeeSar, decimal supervisorDiscountSar) =>
        Math.Max(0m, agreedFeeSar - Math.Max(0m, supervisorDiscountSar));

    /// <summary>Agreed fee must be entered before leaving draft (employees / deferred survey).</summary>
    public static bool HasBillableAgreedFee(decimal agreedFeeSar) => agreedFeeSar > 0m;
}
