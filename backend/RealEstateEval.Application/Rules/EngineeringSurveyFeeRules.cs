namespace RealEstateEval.Application.Rules;

/// <summary>
/// Default engineering-survey fees. External offices treat as متعاون شركة.
/// </summary>
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
            ? InspectorFeeRules.TypeCooperatorOrganization
            : InspectorFeeRules.TypeEmployee;

    public static decimal DefaultAgreedFee(string officeType) =>
        officeType switch
        {
            InspectorFeeRules.TypeCooperatorOrganization
                or InspectorFeeRules.TypeCooperatorLegacy
                or InspectorFeeRules.TypeCooperatorIndividual
                => ExternalOfficeFeeSar,
            _ => InternalOfficeFeeSar,
        };

    public static decimal NetFee(decimal agreedFeeSar, decimal supervisorDiscountSar) =>
        InspectorFeeRules.NetFee(agreedFeeSar, supervisorDiscountSar);
}
