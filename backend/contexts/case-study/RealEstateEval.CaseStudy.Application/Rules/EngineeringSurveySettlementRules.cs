using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The engineering office is settled before the study reaches the appraiser (Omar 2026-11-11: «دارس
/// العقار يقرر قبل إرسال الدراسة للمقيّم: إما أن المكتب الهندسي ضروري، أو يتجاوز عنه ويرسل الدراسة بدون مكتب
/// هندسي، ولا يُحتسب في الأتعاب»). Replaces the ruling of 2026-11-04, under which a survey added after
/// the send to the study never blocked the issue.
/// </summary>
/// <remarks>
/// How it works: issuing the study report is what opens the valuation to the appraiser, so the issue
/// is refused while a live engineering-survey task of the transaction is not settled. A survey is
/// settled when the office delivered it and its outputs were accepted (the office is necessary — its
/// fee is accrued at that acceptance), or when the study skipped it («تجاوز المكتب الهندسي»: the task
/// is cancelled before any acceptance, so no fee is ever accrued for it).
/// Edge cases: cancelled tasks are ignored; a transaction with no survey task at all is settled.
/// The skip is kept to the narrowest case (Omar 2026-11-11: «التجاوز يكون في أضيق الحدود»): an office
/// that has not delivered. Once it delivered, its work is complete — the outputs are received, and a
/// study that does not want the fee counted uses the discount («قبول مع اقتراح حسم», with its reason)
/// instead of a skip.
/// </remarks>
public static class EngineeringSurveySettlementRules
{
    public const string NotDeliveredAr =
        "لم يسلّم المكتب الهندسي عمله بعد — انتظره، أو تجاوز عنه من قسم «المكتب الهندسي» ثم أصدر التقرير.";

    public const string NotAcceptedAr =
        "سلّم المكتب الهندسي عمله ولم تُستلم مخرجاته بعد — استلمها من قسم «المكتب الهندسي» («قبول المخرجات»، أو «قبول مع اقتراح حسم» إن لم تُرد احتساب أتعابه) ثم أصدر التقرير.";

    public const string SkipRoleDeniedAr =
        "تجاوز المكتب الهندسي صلاحية دارس العقار أو مشرف القسم أو مسؤول التحول الرقمي";

    public const string SkipNothingLiveAr = "لا يوجد رفع مساحي قائم على هذا العقار";

    public const string SkipAfterDeliveryAr =
        "سلّم المكتب الهندسي عمله فلا يُتجاوز عنه — استلم مخرجاته، وإن لم تُرد احتساب أتعابه فاختر «قبول مع اقتراح حسم» واذكر السبب.";

    /// <summary>
    /// Why the study report cannot be issued yet because of the engineering office, or null when every
    /// live survey of the transaction is settled.
    /// </summary>
    /// <param name="surveys">The engineering-survey tasks of every deed the study covers, any status.</param>
    public static string? BlocksIssueAr(IEnumerable<ReceiptPartyFacts> surveys)
    {
        var live = surveys
            .Where(s => s.Kind == WorkflowTaskKind.EngineeringSurvey && s.Status != WorkflowTaskStatus.Cancelled)
            .ToList();
        if (live.Any(s => s.Status != WorkflowTaskStatus.Completed
                          || s.SubmissionStatus != PartyTaskSubmissionStatus.Submitted))
            return NotDeliveredAr;
        return live.Any(s => !s.Accepted) ? NotAcceptedAr : null;
    }

    /// <summary>
    /// «تجاوز المكتب الهندسي» — the study sub-role decides it; the section supervisor, the general
    /// manager and the CDO may too.
    /// </summary>
    public static bool CanSkip(StaffActor actor) =>
        WorkflowTaskLifecycleRules.IsSectionSupervisorOrAbove(actor.Role) || actor.HoldsStudy;

    /// <summary>The office is told its task was dropped, with the study's reason.</summary>
    public static CreateUserNotificationRequest SkippedRequest(WorkflowTask child, string refLabel, string reason) =>
        new()
        {
            Title = "أُلغيت مهمة الرفع المساحي",
            Body = $"تجاوزت الدراسة عن الرفع المساحي على {refLabel} — لم تعد المهمة ضمن أعمالك: {reason}",
            Tone = NotificationContract.Tones.Warn,
            Href = "/operations-tasks",
            Category = NotificationContract.Categories.Workflow,
            EntityType = NotificationContract.EntityTypes.Task,
            EntityId = child.Id.ToString(),
            SourceEvent = $"engineering-survey-skipped:{child.Id}:{child.UpdatedAtUtc:O}",
        };
}
