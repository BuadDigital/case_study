using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>Party work submission for child workflow tasks (survey, appraisal, review, etc.).</summary>
public class PartyTaskSubmission
{
    public Guid Id { get; set; }
    public Guid WorkflowTaskId { get; set; }
    public string Kind { get; set; } = "";
    public string Status { get; set; } = PartyTaskSubmissionStatus.Draft;
    public Guid? PropertyId { get; set; }
    public string? PoNumber { get; set; }
 /// <summary>JSON payload matching frontend submission types per kind.</summary>
    public string PayloadJson { get; set; } = "{}";
    public string? ReturnNote { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
 /// <summary>
 /// Set when a specialist accepts party outputs (survey fee accrual; inspection → إنفاذ package gate).
 /// </summary>
    public DateTime? AcceptedAtUtc { get; set; }
    public string? SubmittedByUserId { get; set; }
    public string? SubmittedByName { get; set; }
    public string? AcceptedByUserId { get; set; }
    public string? AcceptedByName { get; set; }
    public string? ReopenedByUserId { get; set; }
    public string? ReopenedByName { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    /* ─── B2: دورة الحياة داخل الجذر — مسودة ⇄ معادة → مُرسلة → (مقبولة) → معادة ─── */

    public static PartyTaskSubmission CreateDraft(
        Guid workflowTaskId,
        string kind,
        Guid? propertyId,
        string? poNumber,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = workflowTaskId,
            Kind = kind,
            Status = PartyTaskSubmissionStatus.Draft,
            PropertyId = propertyId,
            PoNumber = poNumber,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
        };

 /// <summary>
 /// حفظ مسودة: «مُرسلة» عبر مسار المسودة مرفوضة (نقطة الإرسال وحدها ترسل)،
 /// و«المعادة» تبقى معادة حتى تُرسل من جديد.
 /// </summary>
    public string? SaveDraft(
        string payloadJson,
        string? requestedStatus,
        Guid? propertyId,
        string? poNumber,
        DateTime nowUtc)
    {
        if (requestedStatus is PartyTaskSubmissionStatus.Submitted)
            return "استخدم نقطة الإرسال لتقديم العمل";

        PayloadJson = payloadJson;
        Status = requestedStatus is PartyTaskSubmissionStatus.Reopened
            ? PartyTaskSubmissionStatus.Reopened
            : PartyTaskSubmissionStatus.Draft;
        PropertyId = propertyId;
        PoNumber = poNumber;
        UpdatedAtUtc = nowUtc;
        return null;
    }

 /// <summary>الإرسال — من مسودة/معادة فقط؛ المُرسلة سلفاً لا تتغيّر (تكرار حميد).</summary>
    public bool Submit(DateTime nowUtc, string? userId, string? displayName, string fallbackName)
    {
        if (Status is PartyTaskSubmissionStatus.Submitted)
            return false;

        Status = PartyTaskSubmissionStatus.Submitted;
        SubmittedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        if (userId is not null)
        {
            SubmittedByUserId = userId;
            SubmittedByName = string.IsNullOrWhiteSpace(displayName)
                ? fallbackName
                : displayName.Trim();
        }

        return true;
    }

 /// <summary>
 /// الإعادة للتصحيح — من «مُرسلة» فقط؛ تُبطل القبول حتى يعتمد الأخصائي المخرجات
 /// المصحّحة من جديد.
 /// </summary>
    public string? ReturnForCorrection(
        string? returnNote,
        DateTime nowUtc,
        string? userId,
        string? displayName)
    {
        if (Status != PartyTaskSubmissionStatus.Submitted)
            return "لا يوجد إرسال مُكتمل لإعادته";

        Status = PartyTaskSubmissionStatus.Reopened;
        ReturnNote = returnNote;
        SubmittedAtUtc = null;
        AcceptedAtUtc = null;
        AcceptedByUserId = null;
        AcceptedByName = null;
        ReopenedByUserId = userId;
        ReopenedByName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
        UpdatedAtUtc = nowUtc;
        return null;
    }

 /// <summary>قبول المخرجات — من «مُرسلة» فقط؛ القبول المكرر لا يغيّر الختم الأول.</summary>
    public string? Accept(DateTime nowUtc, string actorUserId, string? displayName)
    {
        if (Status != PartyTaskSubmissionStatus.Submitted)
            return "لا يوجد إرسال مكتمل لقبوله";
        if (AcceptedAtUtc is not null)
            return null;

        AcceptedAtUtc = nowUtc;
        AcceptedByUserId = actorUserId;
        AcceptedByName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
        UpdatedAtUtc = nowUtc;
        return null;
    }
}
