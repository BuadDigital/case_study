namespace RealEstateEval.Application.Contracts;

/// <summary>Editable default fee schedule used when creating new ledgers.</summary>
public sealed class PartyFeePricingDto
{
    public decimal EngineeringSurveyFeeSar { get; set; }
    public decimal GovernmentReviewFeeSar { get; set; }
    public decimal FieldInspectorIndividualFeeSar { get; set; }
    public decimal FieldInspectorOrganizationFeeSar { get; set; }
    public decimal FieldInspectorEmployeeFeeSar { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}
