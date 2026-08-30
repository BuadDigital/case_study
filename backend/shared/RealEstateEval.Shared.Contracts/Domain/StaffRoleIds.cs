namespace RealEstateEval.Domain;

/// <summary>
/// Supported role IDs (Q-2: code names are legal — no renaming).
/// The letters were scattered and the “Supervisor and above” group was copied into two files.
/// Note: These are role identifiers — not to be confused with the information matrix pin alphabet
/// (specA/insp/gov/val/eng/sup) nor with distribution identifier prefixes (fi-/eo-/cs-…),
/// It is a vocabulary of deliberately different fields.
/// </summary>
public static class StaffRoleIds
{
    public const string Cdo = "cdo";
    public const string GeneralManager = "general-manager";
    public const string SectionSupervisor = "section-supervisor";
    public const string CaseSpecialist = "case-specialist";
    public const string GovernmentReviewer = "government-reviewer";
    public const string RealEstateAppraiser = "real-estate-appraiser";
    public const string FieldInspector = "field-inspector";
    public const string FinancialOfficer = "financial-officer";
    public const string EngineeringOffice = "engineering-office";

 /// <summary>Department Supervisor and above — were copied into the deployment and lifecycle orders.</summary>
    public static readonly IReadOnlyList<string> SectionSupervisorOrAbove =
    [
        SectionSupervisor,
        GeneralManager,
        Cdo,
    ];
}
