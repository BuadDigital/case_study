namespace RealEstateEval.Domain;

/// <summary>Singleton default party-fee pricing (editable; not hardcoded business rates).</summary>
public class PartyFeePricingConfig
{
    public Guid Id { get; set; }

    /// <summary>Engineering office — external survey completion default.</summary>
    public decimal EngineeringSurveyFeeSar { get; set; }

    /// <summary>Government reviewer — متعاون فرد only.</summary>
    public decimal GovernmentReviewFeeSar { get; set; }

    /// <summary>أتعاب استلام مفاتيح من المحكمة (تحصيل من إنفاذ).</summary>
    public decimal KeyReceiptFeeSar { get; set; }

    public decimal FieldInspectorIndividualFeeSar { get; set; }
    public decimal FieldInspectorOrganizationFeeSar { get; set; }
    public decimal FieldInspectorEmployeeFeeSar { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}
