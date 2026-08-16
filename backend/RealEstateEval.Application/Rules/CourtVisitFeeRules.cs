using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Court-visit ops fee rules (formerly government-review pricing).
/// Reviewers are either employees (no visit fee — incentives via flat table) or individual
/// cooperators (specialist sets the visit amount at create; stamped on complete).
/// </summary>
public static class CourtVisitFeeRules
{
 /// <summary>Cooperator individual — the party type priced by <c>CourtVisitFeeSar</c>.</summary>
    public const string PartyType = InspectorFeeRules.TypeCooperatorIndividual;

    public static string ResolveReviewerType(
        ContractType? contractType,
        ProcProviderKind? providerKind,
        string? employmentType,
        string? assigneeId)
    {
        if (contractType is not null || providerKind is not null || !string.IsNullOrWhiteSpace(employmentType))
        {
            if (contractType == ContractType.ServiceProvider
                || providerKind == ProcProviderKind.Organization)
            {
                return InspectorFeeRules.TypeCooperatorOrganization;
            }

            if (contractType == ContractType.Freelance
                || providerKind == ProcProviderKind.Individual
                || employmentType?.Contains("متعاون", StringComparison.Ordinal) == true)
            {
                return InspectorFeeRules.TypeCooperatorIndividual;
            }

            return InspectorFeeRules.TypeEmployee;
        }

        return InspectorFeeRules.ResolveInspectorType(assigneeId);
    }

    public static bool RequiresVisitFee(string? reviewerType) =>
        InspectorFeeRules.IsCooperator(reviewerType);
}
