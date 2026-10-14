using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface ICaseStudyReportService
{
 /// <summary>
 /// Reads a form. When <paramref name="actor"/> is supplied, party forms require
 /// <see cref="Rules.PoRoleMatrixRules.CanReadPartyTask"/> and the internal case-study form
 /// requires case-staff role; otherwise null is returned so callers cannot probe existence.
 /// When the task exists and the actor may read it, an unsaved empty form is returned
 /// instead of null so first open is 200 rather than 404.
 /// </summary>
    Task<CaseStudyReportDto?> GetAsync(
        Guid taskId,
        bool party,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default);
    Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid taskId,
        bool party,
        CaseStudyReportDto form,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Issues the specialist's report (the final client state in <paramref name="report"/>). Checks in
    /// order: role (case specialist only, when an actor is given), the active-failure / blocked gate, the
    /// deed↔nature match, then the 100% completeness rule on <paramref name="report"/>'s answers; then ONE
    /// transaction: status issued + parent task completed + party contributions locked. Idempotent: an
    /// already issued report whose parent is not completed finishes the completion; issued and completed
    /// is a no-op. Returns <c>(null, null)</c> when the task does not exist. Errors keys: <c>answers</c> and
    /// <c>missingQuestionKeys</c> (completeness), <c>_</c> (role, failure, state), the deed-match keys.
    /// </summary>
    Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> IssueAsync(
        Guid taskId,
        CaseStudyReportDto report,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Reopens an issued report (case specialist only, when an actor is given): report issued → draft,
    /// parent task completed → open in the case-study phase, the Enfaz handover stamp cleared when
    /// <paramref name="clearEnfazHandover"/> confirms it (field error <c>enfazHandover</c> otherwise), and
    /// the party contributions of still-open children unlocked — all in ONE transaction. No fee reversal.
    /// A submitted appraisal package is not touched; the result flags it and the appraiser is notified.
    /// Returns <c>(null, null)</c> when the task does not exist.
    /// </summary>
    Task<(ReopenCaseStudyReportResultDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        string? reason,
        bool clearEnfazHandover,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default);
}
