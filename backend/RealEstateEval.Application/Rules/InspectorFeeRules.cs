namespace RealEstateEval.Application.Rules;

public static class InspectorFeeRules
{
    public const decimal CooperatorFeeSar = 400m;
    public const decimal EmployeeFeeSar = 100m;

    private static readonly HashSet<string> CooperatorAssigneeIds = new(StringComparer.Ordinal)
    {
        "fi-ahmed",
    };

    public static string ResolveInspectorType(string? assigneeId) =>
        assigneeId is not null && CooperatorAssigneeIds.Contains(assigneeId)
            ? "متعاون"
            : "موظف";

    public static decimal DefaultAgreedFee(string inspectorType) =>
        inspectorType == "متعاون" ? CooperatorFeeSar : EmployeeFeeSar;

    public static decimal NetFee(decimal agreedFeeSar, decimal supervisorDiscountSar) =>
        Math.Max(0m, agreedFeeSar - Math.Max(0m, supervisorDiscountSar));
}
