using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Which case-specialist sub-role hears a workflow event, now that every specialist stage is a
/// shared queue of its sub-role (Omar's ruling 2026-11-02) instead of one named specialist.
/// </summary>
/// <remarks>
/// How it works: pure mappings to the sub-role words of <see cref="CaseSpecialistSubRoles"/>; the
/// caller resolves the holders with <c>ResolveCaseSpecialistUserIdsAsync</c>.
/// Edge cases: an inspection or survey resubmitted after the formal receipt (the study returned it)
/// goes to study — the coordination receipt is already behind it.
/// </remarks>
public static class CaseSpecialistAudience
{
    /// <summary>
    /// A party submitted its package: the appraiser's hand-over goes to study (the report draft);
    /// an inspection or a survey goes to coordination for the formal receipt, or to study when the
    /// transaction was already received.
    /// </summary>
    public static string OnPartySubmitted(WorkflowTaskKind kind, bool alreadyReceived = false) =>
        kind == WorkflowTaskKind.PropertyAppraisal || alreadyReceived
            ? CaseSpecialistSubRoles.Study
            : CaseSpecialistSubRoles.Coordination;

    /// <summary>Failures, keys, cancellations and every operational notice — coordination always.</summary>
    public const string Operations = CaseSpecialistSubRoles.Coordination;

    /// <summary>The appraiser asked to recall his valuation — study decides it.</summary>
    public const string AppraisalRecall = CaseSpecialistSubRoles.Study;

    /// <summary>The appraiser approved (or withdrew his approval of) the report draft — review deposits it.</summary>
    public const string DraftApproval = CaseSpecialistSubRoles.Review;
}
