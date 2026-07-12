namespace RealEstateEval.Application.Rules;

/// <summary>Default government-review fees (متعاون فرد / شركة / موظف).</summary>
public static class GovernmentReviewFeeRules
{
    public const decimal CooperatorIndividualFeeSar = 350m;
    public const decimal CooperatorOrganizationFeeSar = 450m;
    public const decimal EmployeeFeeSar = 100m;

    public static decimal DefaultAgreedFee(string partyType) =>
        partyType switch
        {
            InspectorFeeRules.TypeCooperatorOrganization => CooperatorOrganizationFeeSar,
            InspectorFeeRules.TypeCooperatorIndividual
                or InspectorFeeRules.TypeCooperatorLegacy
                => CooperatorIndividualFeeSar,
            _ => EmployeeFeeSar,
        };
}
