namespace RealEstateEval.Application.Rules;

/// <summary>
/// Default field-inspection fees.
/// متعاون فرد / متعاون شركة / موظف — plus legacy "متعاون" → فرد.
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
    public const decimal EmployeeFeeSar = 100m;

    private static readonly HashSet<string> CooperatorAssigneeIds = new(StringComparer.Ordinal)
    {
        "fi-ahmed",
    };

    public static string ResolveInspectorType(string? assigneeId) =>
        assigneeId is not null && CooperatorAssigneeIds.Contains(assigneeId)
            ? TypeCooperatorIndividual
            : TypeEmployee;

    public static decimal DefaultAgreedFee(string inspectorType) =>
        inspectorType switch
        {
            TypeCooperatorOrganization => CooperatorOrganizationFeeSar,
            TypeCooperatorIndividual or TypeCooperatorLegacy => CooperatorIndividualFeeSar,
            _ => EmployeeFeeSar,
        };

    public static bool IsEmployee(string? inspectorType) =>
        string.Equals(inspectorType, TypeEmployee, StringComparison.Ordinal);

    public static bool IsCooperator(string? inspectorType) =>
        inspectorType is TypeCooperatorIndividual
            or TypeCooperatorOrganization
            or TypeCooperatorLegacy;

    public static decimal NetFee(decimal agreedFeeSar, decimal supervisorDiscountSar) =>
        Math.Max(0m, agreedFeeSar - Math.Max(0m, supervisorDiscountSar));
}
