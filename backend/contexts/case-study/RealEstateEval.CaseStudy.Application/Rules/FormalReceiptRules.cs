using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>One field party's work on a deed, as the formal receipt reads it.</summary>
/// <param name="Accepted">The coordinator received (accepted) the submitted package (Omar 2026-11-08).</param>
public sealed record ReceiptPartyFacts(
    string DeedLabel,
    WorkflowTaskKind Kind,
    WorkflowTaskStatus Status,
    string? SubmissionStatus,
    bool Accepted = false);

/// <summary>
/// «إرسال المعاملة للدراسة» (Omar's rulings 2026-11-02 and 2026-11-08): coordination receives every field
/// party's work — each package submitted AND accepted on the coordinator's page (the fees are accrued
/// there) — every external delivery recorded on the transaction, and every task linked to its deeds,
/// then sends the transaction to the shared «دراسة العقار» queue.
/// </summary>
/// <remarks>
/// How it works: every live field-inspection and engineering-survey task of every deed of the
/// transaction must carry a submitted and accepted package; each one that does not is one Arabic
/// reason. A pending external delivery and an open linked task are reasons too. The appraiser is not
/// waited for — his hand-over comes after the study.
/// Edge cases: cancelled tasks are ignored; a deed with no inspection task at all (not distributed)
/// is a reason of its own; the packages' required attachments are guaranteed by the parties' submit
/// validators, so a submitted package counts as delivered with its attachments.
/// </remarks>
public static class FormalReceiptRules
{
    public const string NotInCaseStudyAr = "إرسال المعاملة للدراسة بعد التوزيع، والمعاملة ليست في مرحلة دراسة الحالة.";
    public const string AlreadyReceivedAr = "أُرسلت المعاملة للدراسة من قبل.";
    public const string RoleDeniedAr = "إرسال المعاملة للدراسة لأخصائي التنسيق.";
    public const string LinkedTasksUnreadableAr = "تعذّر التحقق من المهام المرتبطة بالمعاملة — أعد المحاولة.";

    public static IReadOnlyList<string> MissingAr(
        IReadOnlyCollection<string> deedLabels,
        IReadOnlyCollection<ReceiptPartyFacts> parties,
        IReadOnlyCollection<string>? pendingExternal = null,
        IReadOnlyCollection<string>? openLinkedTasks = null)
    {
        var reasons = new List<string>();
        var live = parties.Where(p => p.Status != WorkflowTaskStatus.Cancelled).ToList();
        foreach (var deed in deedLabels)
        {
            var onDeed = live.Where(p => p.DeedLabel == deed).ToList();
            if (!onDeed.Any(p => p.Kind == WorkflowTaskKind.FieldInspection))
                reasons.Add($"{Prefix(deed, deedLabels.Count)}لم تُوزَّع المعاينة الميدانية بعد.");
            foreach (var party in onDeed.Where(p => p.Kind is WorkflowTaskKind.FieldInspection or WorkflowTaskKind.EngineeringSurvey))
            {
                var what = party.Kind == WorkflowTaskKind.FieldInspection
                    ? "المعاين الميداني"
                    : "المكتب الهندسي";
                if (party.SubmissionStatus != PartyTaskSubmissionStatus.Submitted)
                    reasons.Add($"{Prefix(deed, deedLabels.Count)}لم يسلّم {what} عمله بعد.");
                else if (!party.Accepted)
                    reasons.Add($"{Prefix(deed, deedLabels.Count)}سلّم {what} عمله ولم تستلمه بعد.");
            }
        }

        foreach (var external in pendingExternal ?? [])
            reasons.Add($"بانتظار طرف خارجي: {external}.");
        foreach (var linked in openLinkedTasks ?? [])
            reasons.Add($"مهمة مرتبطة لم تُقبل مخرجاتها: {linked}.");

        return reasons;
    }

    private static string Prefix(string deed, int deedCount) =>
        deedCount > 1 && !string.IsNullOrWhiteSpace(deed) ? $"{deed}: " : "";
}
