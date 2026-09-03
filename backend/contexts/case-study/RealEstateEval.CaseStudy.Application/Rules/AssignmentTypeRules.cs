namespace RealEstateEval.CaseStudy.Application.Rules;

using RealEstateEval.Domain;

/// <summary>
/// AssignmentType rules according to the v2 specification (tags based on the current AssignmentType value):
/// Implementation = execution/execution, estates = execution/inheritance, private sector = private/private.
/// </summary>
public static class AssignmentTypeRules
{
 /// <summary>Court path: order number + court/circuit + Assignment Decision + visits/keys.</summary>
    public static bool IsCourtPath(AssignmentType type) =>
        type == AssignmentType.Execution;

    public static bool RequiresRequestNumber(AssignmentType type) =>
        IsCourtPath(type);

    public static bool RequiresAssignmentDecree(AssignmentType type) =>
        IsCourtPath(type);

    public static bool RequiresCourtAndCircuit(AssignmentType type) =>
        IsCourtPath(type);

 /// <summary>The liaison officer is mandatory in execution and estates, optional in private.</summary>
    public static bool RequiresContacts(AssignmentType type) =>
        type != AssignmentType.PrivateSector;

    public static int BusinessDaysRequired(AssignmentType type) =>
        BusinessDaysRequired(
            type,
            BusinessDueDateCalculator.DefaultBusinessDays,
            BusinessDueDateCalculator.PrivateSectorBusinessDays);

    public static int BusinessDaysRequired(
        AssignmentType type,
        int defaultBusinessDays,
        int privateSectorBusinessDays) =>
        type == AssignmentType.PrivateSector
            ? Math.Max(1, privateSectorBusinessDays)
            : Math.Max(1, defaultBusinessDays);

    // PrimaryLabel/SecondaryLabel/CompositeTag deleted: zero callers, was using
    // “Private” while the legal designation is “Private Sector” in AssignmentTypeLabels.
}
