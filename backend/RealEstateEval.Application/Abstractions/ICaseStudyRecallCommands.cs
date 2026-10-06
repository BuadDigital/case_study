namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Valuation → Case Study: hand an approved appraiser recall back to the appraiser's package.
/// Case Study owns the package; Valuation only calls HTTP. Idempotent on the owner side, so a
/// failed second step in Valuation can retry the whole decision.
/// </summary>
public interface ICaseStudyRecallCommands
{
    /// <summary>
    /// Reopens the submitted appraisal package of <paramref name="appraisalTaskId"/> with the
    /// caller (the deciding specialist, via the forwarded bearer) as the actor. A package that
    /// is not submitted is a successful no-op. A refusal comes back as an Arabic message;
    /// transport failures throw.
    /// </summary>
    Task<(bool Reopened, string? Error)> ReopenAppraisalForRecallAsync(
        Guid appraisalTaskId,
        string? reason,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// A deposited valuation report is reopened as a new version (n+1) by the case specialist: the appraiser's
    /// submitted package goes back to him and his completed task opens again. Idempotent on the owner side;
    /// a refusal comes back as an Arabic message, transport failures throw.
    /// </summary>
    Task<(bool Reopened, string? Error)> ReopenAppraisalForNewVersionAsync(
        Guid appraisalTaskId,
        string? reason,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<(bool Reopened, string? Error)>((false, "إعادة الفتح بنسخة جديدة غير مدعومة"));
}
