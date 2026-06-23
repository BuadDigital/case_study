namespace RealEstateEval.Application.Rules;

public static class EngineeringSurveyFeeRules
{
    public const decimal ExternalOfficeFeeSar = 500m;
    public const decimal InternalOfficeFeeSar = 150m;

    private static readonly HashSet<string> ExternalOfficeAssigneeIds = new(StringComparer.Ordinal)
    {
        "eo-jeddah",
        "jeddah_survey",
    };

    public static string ResolveOfficeType(string? assigneeId) =>
        assigneeId is not null && ExternalOfficeAssigneeIds.Contains(assigneeId.Trim())
            ? "متعاون"
            : "موظف";

    public static decimal DefaultAgreedFee(string officeType) =>
        officeType == "متعاون" ? ExternalOfficeFeeSar : InternalOfficeFeeSar;

    public static decimal NetFee(decimal agreedFeeSar, decimal supervisorDiscountSar) =>
        InspectorFeeRules.NetFee(agreedFeeSar, supervisorDiscountSar);
}
