using RealEstateEval.Shared.Contracts;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
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
            ? new Dictionary<string, string> { ["reason"] = "سبب التعذّر مطلوب" }
            : null;

    /// <summary>The final failure is the section supervisor's call (the CDO keeps every power).</summary>
    /// <remarks>
    /// How it works: a case-insensitive match of the caller's prototype role against
    /// <c>section-supervisor</c> and <c>cdo</c>; the failures controller checks it before
    /// <c>POST /api/failures/final</c>, the frontend mirrors it in <c>canRecordFinalFailure</c>.
    ///
    /// Edge cases: the capability policy alone (<c>manage-failures</c>) also admits the case
    /// specialist, so without this check a specialist could finalize — only the supervisor may.
    /// The general manager is left out on purpose (view-only on failures).
    /// A missing role is refused.
    /// </remarks>
    public static bool CanRecordFinalFailure(string? prototypeRole) =>
        string.Equals(prototypeRole, StaffRoleIds.SectionSupervisor, StringComparison.OrdinalIgnoreCase)
        || string.Equals(prototypeRole, StaffRoleIds.Cdo, StringComparison.OrdinalIgnoreCase);

    /// <summary>The raiser label of a failure the supervisor files with the final failure.</summary>
    public const string SupervisorRaiserRole = "المشرف";

    /// <summary>Field errors of a final-failure request: the deed must parse and the reason is required.</summary>
    /// <remarks>
    /// How it works: checks the request alone, before any lookup — <c>propertyId</c> must be a
    /// non-empty Guid, <c>reason</c> must be non-blank and at most 4000 characters once trimmed
    /// (the <c>FinalNote</c> column width). Null when both hold.
    ///
    /// Edge cases: the problem type is not checked here — it is needed only when a deed of the
    /// transaction has no open failure, which the service learns after the lookup and answers as
    /// a <c>problemTypeId</c> field error.
    /// </remarks>
    public static Dictionary<string, string>? ValidateFinalFailure(FinalFailureRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (!FailureRules.TryParsePropertyId(request.PropertyId, out _))
            errors["propertyId"] = "العقار غير موجود";
        if (string.IsNullOrWhiteSpace(request.Reason))
            errors["reason"] = "اكتب سبب التعذّر النهائي";
        else if (request.Reason.Trim().Length > 4000)
            errors["reason"] = "السبب أطول من المسموح";
        return errors.Count > 0 ? errors : null;
    }

    /// <summary>The failure filed on a deed that had none when the final failure lands on it.</summary>
    /// <remarks>
    /// How it works: an internal failure on the deed with the supervisor's chosen problem type and
    /// its label as the title, raised by «المشرف», with the reason as its note — the service then
    /// finalizes it at once, so it never shows as an open failure.
    ///
    /// Edge cases: a blank title falls back to the problem-type id (<c>FailureRules.ResolveTitle</c>);
    /// the deed number is the sibling deed's own, not the anchor's.
    /// </remarks>
    public static CreateFailureRequest FinalFailureCreateRequest(
        FinalFailureRequest request,
        string poNumber,
        CaseStudyPropertySnapshotDto deed) =>
        new()
        {
            PoNumber = poNumber,
            PropertyId = deed.Id.ToString("D"),
            DeedNumber = deed.DeedNumber,
            ProblemTypeId = request.ProblemTypeId?.Trim() ?? "",
            Title = request.Title?.Trim(),
            Severity = PropertyFailureSeverity.Internal,
            RaisedByRole = SupervisorRaiserRole,
            InternalNote = request.Reason.Trim(),
        };

    /// <summary>The notice a party holding a task on the deed receives (when the supervisor asks for it).</summary>
    /// <remarks>
    /// How it works: names the deed, its work order and the supervisor's reason, and links to the
    /// property page (parties can open it from their workspace; the failures queue they cannot).
    ///
    /// Edge cases: <c>SourceEvent</c> is keyed on the failure id, so a retried call does not
    /// notify twice; one notice per deed — a party on two deeds of the transaction gets two.
    /// </remarks>
    public static CreateUserNotificationRequest FinalFailurePartyNotification(PropertyFailure failure) =>
        new()
        {
            Title = "تعذّر نهائي عن المعاملة",
            Body = $"توقّف العمل على الصك {failure.DeedNumber} في أمر العمل {failure.PoNumber}: {failure.FinalNote}",
            Tone = "warn",
            Href = $"/po/{Uri.EscapeDataString(failure.PoNumber)}/property/{failure.PropertyId:D}",
            Category = NotificationContract.Categories.Failures,
            EntityType = NotificationContract.EntityTypes.Failure,
            EntityId = failure.Id.ToString(),
            SourceEvent = $"failure-final-party:{failure.Id}",
        };

    /// <summary>The shortest reason (trimmed) a survey-freeze lift is recorded with.</summary>
    public const int MinSurveyFreezeLiftReasonLength = 10;

    public const string LiftSurveyFreezeRoleDeniedAr = "فك تجميد الرفع المساحي متاح لأخصائي دراسة الحالة فقط";

    /// <summary>Field errors of a lift request: the property must parse and the reason needs ten characters.</summary>
    public static Dictionary<string, string> ValidateLiftSurveyFreeze(LiftSurveyFreezeRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(request.PoNumber))
            errors["poNumber"] = "رقم أمر العمل مطلوب";
        if (string.IsNullOrWhiteSpace(request.PropertyId))
            errors["propertyId"] = "معرّف العقار مطلوب";
        else if (!FailureRules.TryParsePropertyId(request.PropertyId, out _))
            errors["propertyId"] = "معرّف العقار غير صالح";
        if ((request.Reason ?? "").Trim().Length < MinSurveyFreezeLiftReasonLength)
            errors["reason"] = "اكتب سبب فك التجميد (10 أحرف على الأقل)";
        return errors;
    }

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
            return new Dictionary<string, string> { ["propertyId"] = "لا يمكن تسجيل تعذّر على عقار محذوف" };
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
    /// display name when <paramref name="namesById"/> knows the user id. The transaction number
    /// comes from <paramref name="property"/> (the case-study snapshot of the failure's deed);
    /// without it the number is null and the deed count one.
    /// </summary>
    /// <remarks>
    /// How it works: copies the aggregate field by field (the escalation note included), then
    /// reads three display fields off the snapshot — <c>TransactionNumber</c> (PR-… or TMP-…),
    /// <c>TransactionDeedCount</c> and <c>CaseSpecialistName</c>, the company's specialist the
    /// queue shows as «الأخصائي».
    ///
    /// Edge cases: blank snapshot values become null and a zero deed count becomes one, so the
    /// queue prints «—» rather than an empty badge. «الأخصائي» used to be filled from the work
    /// order's <c>assignmentSpecialist</c> — that is Enfaz's «أخصائي الإسناد», not the company's —
    /// which is why the name now comes from the deed's case-study task instead.
    /// </remarks>
    public static FailureRecordDto ToDto(
        PropertyFailure entity,
        IReadOnlyDictionary<string, string>? namesById = null,
        CaseStudyPropertySnapshotDto? property = null) => new()
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
        EscalationNote = entity.EscalationNote,
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
        SurveyFreezeLiftedAt = entity.SurveyFreezeLiftedAtUtc?.ToString("O"),
        SurveyFreezeLiftReason = entity.SurveyFreezeLiftReason,
        TransactionNumber = string.IsNullOrWhiteSpace(property?.TransactionNumber)
            ? null
            : property.TransactionNumber.Trim(),
        TransactionDeedCount = Math.Max(1, property?.TransactionDeedCount ?? 1),
        CaseSpecialistName = string.IsNullOrWhiteSpace(property?.CaseSpecialistName)
            ? null
            : property.CaseSpecialistName.Trim(),
    };
}
