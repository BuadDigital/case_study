namespace RealEstateEval.Application.Rules;

/// <summary>
/// Field-inspection party types. Cooperator rates live entirely in the active
/// <c>PartyFeePricingTable</c>; employee inspectors sit outside it and have their fee entered
/// manually. No rate is hard-coded here — an unpriced table must stop the fee.
/// </summary>
public static class InspectorFeeRules
{
    public const string TypeEmployee = "موظف";
    public const string TypeCooperatorIndividual = "متعاون فرد";
    public const string TypeCooperatorOrganization = "متعاون شركة";
 /// <summary>Legacy label kept for older ledgers.</summary>
    public const string TypeCooperatorLegacy = "متعاون";

    private static readonly HashSet<string> CooperatorAssigneeIds = new(StringComparer.Ordinal)
    {
        "fi-ahmed",
    };

    public static string ResolveInspectorType(string? assigneeId) =>
        assigneeId is not null && CooperatorAssigneeIds.Contains(assigneeId)
            ? TypeCooperatorIndividual
            : TypeEmployee;

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
