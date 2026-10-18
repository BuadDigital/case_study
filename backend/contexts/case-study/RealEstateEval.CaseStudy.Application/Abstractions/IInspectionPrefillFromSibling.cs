using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Grouped property: a deed's field inspection starts from its sibling deed's inspection —
/// site inputs and photos (decision 2026-10-18). Runs when the inspector first opens the
/// task, and at the link for a draft that already exists.
/// </summary>
public interface IInspectionPrefillFromSibling
{
    /// <summary>
    /// Fills the inspection draft of <paramref name="taskId"/> from the group sibling's
    /// inspection, creating the draft when none exists. The actor must be allowed to write the
    /// task. Never overwrites: a submitted inspection, or a draft that already holds photos, is
    /// left alone and the result says so.
    /// </summary>
    Task<(InspectionPrefillResultDto? Result, string? Error)> PrefillAsync(
        Guid taskId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The photo leg only, for a destination draft the caller already holds tracked: copies the
    /// source task's photo files to the destination task and links them in the destination
    /// payload. Returns the number of photos linked; the caller saves.
    /// </summary>
    Task<int> CopyPhotosIntoDraftAsync(
        PartyTaskSubmission source,
        PartyTaskSubmission destination,
        CancellationToken cancellationToken = default);
}
