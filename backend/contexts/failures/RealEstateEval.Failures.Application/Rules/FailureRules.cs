using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Application.Rules;

/// <summary>
/// Failure (تعذر) decisions that need no storage: who may see which failures, what a create
/// request normalises to, the reason text each downstream request carries, and the shape of the
/// notifications and timeline entries a transition emits. The service keeps the queries, the
/// SaveChanges and the cross-context calls.
/// </summary>
public static class FailureRules
{
    /// <summary>Failure raised by the system itself when no human is behind it.</summary>
    public const string SystemRaiserRole = DocumentaryWorkflowRules.SystemRaiserRole;

    public const string EvictionProblemTypeId = "access-denied";
    public const string EvictionTitle = "محظر إخلاء — تعليق الدراسة";
    public const string EvictionInternalNote = "تسجيل محظر إخلاء من وحدة الظروف/مسار الدخول.";
    public const string EvictionSuspendNote = "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.";
    public const string EvictionResolutionReason = "رفع محظر الإخلاء من وحدة الظروف";
    public const string EvictionContinueInstructions = "أُزيل محظر الإخلاء — استئناف مسار الدراسة.";

    public const string KeyUnmatchedProblemTypeId = "key-wont-open";
    public const string KeyUnmatchedTitle = "مفتاح العقار غير مطابق";
    public const string KeyUnmatchedNote = "تأكيد ميداني: المفتاح غير مطابق للصك.";

    public const string DeedInactiveProblemTypeId = "deed-inactive";
    public const string DeedInactiveTitle = "متعذر — الصك غير فعال";

    /// <summary>
    /// Supervisors and holders of the failure/work-order capabilities see every failure; everyone
    /// else only sees the work orders they are assigned to.
    /// </summary>
    public static bool SeesEveryFailure(PermissionsDto actor) =>
        PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)
        || actor.Capabilities.Contains("manage-failures", StringComparer.OrdinalIgnoreCase)
        || actor.Capabilities.Contains("manage-work-orders", StringComparer.OrdinalIgnoreCase);

    /// <summary>The assignee keys a scoped actor is allowed to match work orders on.</summary>
    public static string[] VisibilityAssigneeKeys(PermissionsDto actor) =>
        [actor.DistributionAssigneeId?.Trim() ?? "", actor.UserId.Trim()];

    /// <summary>An actor with neither key can see nothing at all.</summary>
    public static bool HasNoVisibilityKey(PermissionsDto actor) =>
        VisibilityAssigneeKeys(actor).All(key => key.Length == 0);

    public static Dictionary<string, string> ValidateCreate(CreateFailureRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(request.PoNumber))
            errors["poNumber"] = "رقم أمر العمل مطلوب";
        if (string.IsNullOrWhiteSpace(request.PropertyId))
            errors["propertyId"] = "معرف العقار مطلوب";
        if (string.IsNullOrWhiteSpace(request.Specialist))
            errors["specialist"] = "اسم الأخصائي مطلوب";
        return errors;
    }

    /// <summary>Only "suspected" is taken from the caller; anything else is an internal failure.</summary>
    public static string NormalizeSeverity(string severity) =>
        severity.Trim().ToLowerInvariant() == PropertyFailureSeverity.Suspected
            ? PropertyFailureSeverity.Suspected
            : PropertyFailureSeverity.Internal;

    /// <summary>A custom title wins; otherwise the problem type names the failure.</summary>
    public static string ResolveTitle(CreateFailureRequest request)
    {
        var custom = request.Title?.Trim();
        if (!string.IsNullOrEmpty(custom)) return custom;
        if (request.ProblemTypeId == DeedInactiveProblemTypeId) return DeedInactiveTitle;
        return request.ProblemTypeId.Trim();
    }

    /// <summary>Blank raiser roles fall back to the specialist who normally raises failures.</summary>
    public static string RaisedByRoleOrDefault(string? raisedByRole) =>
        string.IsNullOrWhiteSpace(raisedByRole) ? "الأخصائي" : raisedByRole.Trim();

    /// <summary>A resolved label of "system" (or nothing) means the system raised it.</summary>
    public static string SpecialistOrSystem(string? resolvedSpecialist) =>
        string.IsNullOrWhiteSpace(resolvedSpecialist)
        || string.Equals(resolvedSpecialist, "system", StringComparison.OrdinalIgnoreCase)
            ? SystemRaiserRole
            : resolvedSpecialist;

    /// <summary>Falls back to the system label when no actor name came through.</summary>
    public static string ActorOrSystem(string? actor) =>
        string.IsNullOrWhiteSpace(actor) ? SystemRaiserRole : actor.Trim();

    public static string EvictionLiftedNote(string actorName) => $"رُفع التعليق بواسطة {actorName}.";

    public static PropertyFailure NewFailure(
        CreateFailureRequest request,
        string raisedByRole,
        string resolvedSpecialist,
        DateTime nowUtc) =>
        PropertyFailure.Create(
            Guid.NewGuid(),
            request.PoNumber,
            request.PropertyId,
            request.DeedNumber,
            ResolveTitle(request),
            request.ProblemTypeId,
            NormalizeSeverity(request.Severity),
            raisedByRole,
            request.InternalNote?.Trim() ?? "",
            resolvedSpecialist,
            nowUtc);

    /// <summary>A bourse obstruction is filed as an internal deed-inactive failure.</summary>
    public static CreateFailureRequest BourseObstructionCreateRequest(BourseObstructionRequest request) =>
        new()
        {
            PoNumber = request.PoNumber,
            PropertyId = request.PropertyId,
            DeedNumber = request.DeedNumber,
            ProblemTypeId = DeedInactiveProblemTypeId,
            Severity = PropertyFailureSeverity.Internal,
            RaisedByRole = "الأخصائي",
            Title = DeedInactiveTitle,
            InternalNote = request.Reason.Trim(),
            Specialist = request.Specialist,
        };

    /// <summary>A failure the system raises for itself, always internal.</summary>
    public static CreateFailureRequest SystemInternalCreateRequest(
        string poNumber,
        string propertyId,
        string deedNumber,
        string problemTypeId,
        string title,
        string note,
        string specialist) =>
        new()
        {
            PoNumber = poNumber,
            PropertyId = propertyId,
            DeedNumber = deedNumber,
            ProblemTypeId = problemTypeId,
            Severity = PropertyFailureSeverity.Internal,
            RaisedByRole = SystemRaiserRole,
            Title = title,
            InternalNote = note,
            Specialist = specialist,
        };

    /// <summary>An eviction hold is born already suspended — the study stops on the spot.</summary>
    public static PropertyFailure NewEvictionHold(
        string poNumber,
        string propertyId,
        string deedNumber,
        string resolvedSpecialist,
        DateTime nowUtc) =>
        PropertyFailure.Reconstitute(
            Guid.NewGuid(),
            poNumber,
            propertyId,
            deedNumber,
            EvictionTitle,
            EvictionProblemTypeId,
            PropertyFailureSeverity.Internal,
            SystemRaiserRole,
            EvictionInternalNote,
            EvictionSuspendNote,
            PropertyFailureStatus.Suspended,
            resolvedSpecialist,
            nowUtc,
            nowUtc,
            suspendedAtUtc: nowUtc);

    public static PropertyFailure NewKeyUnmatchedFailure(
        string poNumber,
        string propertyId,
        string deedNumber,
        string resolvedSpecialist,
        DateTime nowUtc) =>
        PropertyFailure.Create(
            Guid.NewGuid(),
            poNumber,
            propertyId,
            deedNumber,
            KeyUnmatchedTitle,
            KeyUnmatchedProblemTypeId,
            PropertyFailureSeverity.Internal,
            SystemRaiserRole,
            KeyUnmatchedNote,
            resolvedSpecialist,
            nowUtc);

    /// <summary>The reason an obstruction carries: the title, or the note when untitled.</summary>
    public static string ObstructionReason(PropertyFailure failure) =>
        failure.Title.Trim().Length > 0 ? failure.Title : failure.InternalNote;

    /// <summary>The reason blocking the property tasks: final note, then title, then a default.</summary>
    public static string ApprovedBlockReason(PropertyFailure failure)
    {
        var final = failure.FinalNote.Trim();
        if (final.Length > 0) return final;
        var title = failure.Title.Trim();
        return title.Length > 0 ? title : "تعذر معتمد";
    }

    public static EscalateCaseStudyObstructionRequest EscalateRequest(
        PropertyFailure failure,
        string reason) =>
        new()
        {
            PoNumber = failure.PoNumber,
            PropertyId = failure.PropertyId,
            Reason = reason,
        };

    public static ResolveCaseStudyObstructionRequest ResolveObstructionRequest(PropertyFailure failure) =>
        new()
        {
            PoNumber = failure.PoNumber,
            PropertyId = failure.PropertyId,
        };

    public static BlockCaseStudyTasksForFailureRequest BlockTasksRequest(PropertyFailure failure) =>
        new()
        {
            PoNumber = failure.PoNumber,
            PropertyId = failure.PropertyId,
            Reason = ApprovedBlockReason(failure),
        };

    public static SetCaseStudyDeedStatusRequest DeedStatusRequest(
        PropertyFailure failure,
        string deedStatus) =>
        new()
        {
            PoNumber = failure.PoNumber,
            PropertyId = failure.PropertyId,
            DeedNumber = failure.DeedNumber,
            DeedStatus = deedStatus,
        };

    public static PropertyTimelineRecordRequest CreatedTimelineEntry(
        PropertyFailure failure,
        Guid propertyId,
        DateTime nowUtc) =>
        new(
            failure.PoNumber,
            propertyId,
            $"failure:{failure.Id}:created",
            "تسجيل تعذر",
            $"{failure.Title} — {PropertyFailureStatus.LabelAr(failure.Status)}",
            PropertyTimelineTones.Warn,
            nowUtc);

    public static PropertyTimelineRecordRequest SuspendedTimelineEntry(
        PropertyFailure failure,
        Guid propertyId) =>
        new(
            failure.PoNumber,
            propertyId,
            $"failure:{failure.Id}:suspended",
            "تعليق المعاملة",
            failure.FinalNote,
            PropertyTimelineTones.Warn,
            failure.SuspendedAtUtc!.Value);

    public static CreateUserNotificationRequest SubmittedNotification(PropertyFailure failure) =>
        new()
        {
            Title = "تعذر بانتظار المراجعة",
            Body = $"رُفع تعذر للمراجعة على أمر العمل {failure.PoNumber}.",
            Tone = "warn",
            Href = "/failures",
            Category = "failures",
            EntityType = "failure",
            EntityId = failure.Id.ToString(),
            Actor = failure.Specialist,
            SourceEvent = $"failure-submitted:{failure.Id}",
        };

    public static CreateUserNotificationRequest ApprovedNotification(PropertyFailure failure) =>
        new()
        {
            Title = "اعتماد تعذر",
            Body = $"اعتُمد تعذر على أمر العمل {failure.PoNumber}.",
            Tone = "warn",
            Href = "/failures",
            Category = "failures",
            EntityType = "failure",
            EntityId = failure.Id.ToString(),
            SourceEvent = $"failure-approved:{failure.Id}",
        };

    public static CreateUserNotificationRequest CaseStudyBlockedNotification(
        Guid taskId,
        string reason) =>
        HoldNotification(
            taskId,
            "تعليق دراسة الحالة",
            reason,
            PropertyTimelineTones.Warn,
            $"case-study-blocked:{taskId}");

    public static CreateUserNotificationRequest CaseStudyUnblockedNotification(Guid taskId) =>
        HoldNotification(
            taskId,
            "استئناف دراسة الحالة",
            "زال سبب التعليق — استؤنفت المعاملة.",
            "success",
            $"case-study-unblocked:{taskId}");

    private static CreateUserNotificationRequest HoldNotification(
        Guid taskId,
        string title,
        string body,
        string tone,
        string sourceEvent) =>
        new()
        {
            Title = title,
            Body = body,
            Tone = tone,
            Href = $"/case-study/{Uri.EscapeDataString(taskId.ToString())}",
            Category = "workflow",
            EntityType = "task",
            EntityId = taskId.ToString(),
            SourceEvent = sourceEvent,
        };
}
