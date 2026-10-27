// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Access New file — the check that only the appraiser assigned to the property's appraisal task may
//           write valuation work (no supervisor or CDO override); the report-draft actions share it.
// Round 2 (1b19bedc)
//  • CheckRequestAsync / CheckPropertyAsync return AssignedAppraiserVerdict (Assigned / NotAssigned /
//         Unverified), so «Case Study did not answer» is told apart from «not the assigned appraiser».
//  • AssignedAppraiserMessages.UnverifiedAr «تعذّر التحقق من المقيّم المُسنَد — أعد المحاولة» — the
//         caller asks for a retry instead of refusing the user.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Who may write a valuation: only the appraiser assigned to the property's appraisal task — no
/// supervisor or CDO override. The report draft actions and every valuation-work write share it.
/// </summary>
public interface IAssignedAppraiserCheck
{
    /// <summary>The property's latest non-cancelled appraisal task; null when none or Case Study cannot be read.</summary>
    Task<CaseStudyWorkflowTaskSnapshotDto?> FindAppraisalTaskAsync(Guid propertyId, CancellationToken cancellationToken);

    Task<bool> IsAssignedToPropertyAsync(
        Guid propertyId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken);

    /// <summary>False when the request is missing or the caller is not its assigned appraiser.</summary>
    Task<bool> IsAssignedToRequestAsync(
        Guid valuationRequestId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Like <see cref="IsAssignedToRequestAsync"/>, but tells «Case Study could not be read» apart from
    /// «not the assigned appraiser», so the caller can ask for a retry instead of refusing the user.
    /// </summary>
    Task<AssignedAppraiserVerdict> CheckRequestAsync(
        Guid valuationRequestId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken);

    /// <inheritdoc cref="CheckRequestAsync"/>
    Task<AssignedAppraiserVerdict> CheckPropertyAsync(
        Guid propertyId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken);
}

public enum AssignedAppraiserVerdict
{
    Assigned,
    NotAssigned,
    /// <summary>Case Study did not answer (down, timed out) — the assignment is unknown.</summary>
    Unverified,
}

public static class AssignedAppraiserMessages
{
    public const string UnverifiedAr = "تعذّر التحقق من المقيّم المُسنَد — أعد المحاولة";
}
