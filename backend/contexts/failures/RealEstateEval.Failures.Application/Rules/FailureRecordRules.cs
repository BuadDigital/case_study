using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Application.Rules;

/// <summary>
/// Companion to <see cref="FailureRules"/>: the guards a failure command applies to what it
/// looked up, the deed status each transition writes back, the case-study hold request shape,
/// and the wire record a failure maps to. Pure — no ports, no clock.
/// </summary>
public static class FailureRecordRules
{
    /// <summary>Deed status written when a failure is resolved or returned.</summary>
    public const string DeedStatusActive = "فعال";

    /// <summary>Deed status written when a failure is approved.</summary>
    public const string DeedStatusSuspended = "موقوف";

    /// <summary>Deed status written while an internal failure is being verified.</summary>
    public const string DeedStatusUnderVerification = "قيد التحقق";

    /// <summary>A bourse obstruction is only filed with a reason.</summary>
    public static Dictionary<string, string>? ValidateBourseObstruction(BourseObstructionRequest request) =>
        string.IsNullOrWhiteSpace(request.Reason)
            ? new Dictionary<string, string> { ["reason"] = "سبب التعذر مطلوب" }
            : null;

    /// <summary>
    /// The property a failure is raised on must exist and must not have been removed from its
    /// work order. Null when the looked-up property is a valid target.
    /// </summary>
    public static Dictionary<string, string>? ValidateCreateTarget(
        IReadOnlyList<CaseStudyPropertySnapshotDto> properties)
    {
        if (properties.Count == 0)
            return new Dictionary<string, string> { ["propertyId"] = "العقار غير موجود" };
        if (properties[0].IsRemoved)
            return new Dictionary<string, string> { ["propertyId"] = "لا يمكن تسجيل تعذر على عقار محذوف" };
        return null;
    }

    /// <summary>
    /// An unresolved failure that is not yet suspended is force-suspended and re-labelled as
    /// the eviction hold; one already suspended is left untouched.
    /// </summary>
    public static bool NeedsEvictionRefresh(PropertyFailure existing) =>
        existing.Status != PropertyFailureStatus.Suspended;

    /// <summary>The internal-failure obstruction reason, trimmed as the task expects it.</summary>
    public static string InternalObstructionReason(PropertyFailure failure) =>
        FailureRules.ObstructionReason(failure).Trim();

    public static CaseStudyHoldTaskRequest HoldTaskRequest(
        string poNumber,
        Guid propertyId,
        string reason = "") =>
        new()
        {
            PoNumber = poNumber,
            PropertyId = propertyId,
            Reason = reason,
        };

    /// <summary>
    /// Wire record of a failure. The specialist label is normalised, and swapped for the resolved
    /// display name when <paramref name="namesById"/> knows the user id.
    /// </summary>
    public static FailureRecordDto ToDto(
        PropertyFailure entity,
        IReadOnlyDictionary<string, string>? namesById = null) => new()
    {
        Id = entity.Id.ToString(),
        PoNumber = entity.PoNumber,
        PropertyId = entity.PropertyId.ToString("D"),
        DeedNumber = entity.DeedNumber,
        Title = entity.Title,
        ProblemTypeId = entity.ProblemTypeId,
        Severity = entity.Severity,
        RaisedByRole = PersonLabelResolver.NormalizeSystemLabel(entity.RaisedByRole),
        InternalNote = entity.InternalNote,
        FinalNote = entity.FinalNote,
        ResolutionReason = entity.ResolutionReason,
        ContinueInstructions = entity.ContinueInstructions,
        Status = entity.Status,
        Specialist = namesById is null
            ? PersonLabelResolver.NormalizeSystemLabel(entity.Specialist)
            : PersonLabelResolver.ApplyResolved(entity.Specialist, namesById),
        CreatedAt = entity.CreatedAtUtc.ToString("O"),
        UpdatedAt = entity.UpdatedAtUtc.ToString("O"),
        SuspendedAt = entity.SuspendedAtUtc?.ToString("O"),
        SuspendedByUserId = entity.SuspendedByUserId,
    };
}
