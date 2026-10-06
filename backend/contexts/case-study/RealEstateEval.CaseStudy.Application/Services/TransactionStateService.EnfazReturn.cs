using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class TransactionStateService
{
    public const string ReturnRoleDeniedAr =
        "ليس لديك صلاحية استرجاع المعاملة من إنفاذ — الاسترجاع لأخصائي دراسة الحالة";

    public const string NotHandedOverAr = "المعاملة غير مرفوعة على إنفاذ — لا شيء لاسترجاعه";

    public const string ReturnNothingChosenAr = "اختر ما يُعاد فتحه: تقرير دراسة الحالة أو تقرير التقييم";

    /// <summary>The specific reasons, as the one text the handover error carries.</summary>
    internal static string EnfazHandoverBlockedAr(IReadOnlyList<string> reasons) =>
        "لا يمكن رفع المعاملة على إنفاذ: " + string.Join(" · ", reasons);

    /// <summary>
    /// Takes a handed-over transaction back from Enfaz. Order matters because the services do
    /// not share a transaction: the valuation part first (idempotent on retry), then the case-study
    /// part (the report reopen — which clears the handover stamp in its own atomic transaction — or
    /// the stamp clear alone).
    /// The valuation part, when the report is deposited, is the valuation context's own new-version
    /// reopen (a cross-service call, done first so a retry is safe).
    /// </summary>
    public async Task<(TransactionStateDto? Result, Dictionary<string, string>? Errors)> ReturnFromEnfazAsync(
        Guid workOrderId,
        Guid propertyId,
        ReturnFromEnfazRequest request,
        CaseStudyReportActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanReturnFromEnfaz(actor.PrototypeRole))
            return (null, Fail(ReturnRoleDeniedAr));

        var reason = (request.Reason ?? "").Trim();
        if (reason.Length < MinDecisionReasonLength)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = $"سبب الاسترجاع مطلوب ({MinDecisionReasonLength} أحرف على الأقل)",
            });
        }
        if (!request.ReopenStudy && !request.ReopenValuation)
            return (null, Fail(ReturnNothingChosenAr));

        var facts = await LoadFactsAsync(workOrderId, propertyId, cancellationToken);
        if (facts is null) return (null, Fail("المعاملة غير موجودة"));
        var (input, _, property) = facts.Value;
        if (!input.EnfazHandedOver) return (null, Fail(NotHandedOverAr));

        var handoverBefore = new
        {
            at = property.EnfazHandoverAtUtc,
            by = property.EnfazHandoverByUserId,
        };
        var notices = new List<string>();
        var studyOutcome = "not_requested";
        var valuationOutcome = "not_requested";

        // The valuation first: a deposited report reopens as a new version (Valuation also reopens the appraiser's
        // package and task). The order makes a retry safe: if the study part is refused afterwards, the report is no
        // longer deposited on the retry and only the study reopen is repeated.
        if (request.ReopenValuation && input.ValuationReportClosed)
        {
            if (valuationReopen is null)
                return (null, Fail("تعذّر فتح تقرير التقييم بنسخة جديدة الآن — أعد المحاولة"));

            var (reopened, reopenError) = await valuationReopen.ReopenDepositedReportAsync(
                propertyId, reason, cancellationToken);
            if (!reopened)
                return (null, Fail(reopenError ?? "تعذّر فتح تقرير التقييم بنسخة جديدة"));

            valuationOutcome = "reopened_new_version";
            notices.Add("أُعيد فتح تقرير التقييم بنسخة جديدة — يعيد المقيّم تقييمه ثم يُعدّ الأخصائي المسودة ويودع من جديد");
        }

        if (request.ReopenStudy)
        {
            var parent = (await db.ListPropertyTasksAsync(propertyId, cancellationToken))
                .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty)
                .OrderByDescending(t => t.CreatedAtUtc)
                .FirstOrDefault();
            if (parent is null || caseStudyReports is null)
                return (null, Fail("تعذّر تحديد مهمة دراسة الحالة لإعادة فتح تقريرها"));

            // Reopening with clearEnfazHandover clears the stamp inside the report's own transaction.
            var (reopened, errors) = await caseStudyReports.ReopenAsync(
                parent.Id, reason, clearEnfazHandover: true, actor, cancellationToken);
            if (errors is not null) return (null, errors);
            if (reopened is null) return (null, Fail("مهمة دراسة الحالة غير موجودة"));

            studyOutcome = reopened.AppraiserSubmitted ? "reopened_appraiser_submitted" : "reopened";
            notices.Add(reopened.AppraiserSubmitted
                ? "أُعيد فتح تقرير دراسة الحالة — وللمقيّم تقرير مُسلَّم يتطلب مراجعته"
                : "أُعيد فتح تقرير دراسة الحالة");
        }

        var now = _time.UtcNow();
        // A fresh load: the report reopen discards the tracker, and may already have cleared the stamp.
        var current = await db.GetPropertyAsync(workOrderId, propertyId, cancellationToken);
        if (current is null) return (null, Fail("المعاملة غير موجودة"));
        if (current.ClearEnfazHandover())
            await db.SaveChangesAsync(cancellationToken);
        notices.Insert(0, "مُسح ختم التسليم على إنفاذ");

        if (request.ReopenValuation && !input.ValuationReportClosed)
        {
            valuationOutcome = "not_deposited";
            notices.Add("تقرير التقييم غير مودَع — لا شيء لإعادة فتحه، والمقيّم يعدّله مباشرة");
        }

        if (audit is not null && auditLog is not null)
        {
            await auditLog.AppendAsync(audit.Create(
                actorId: string.IsNullOrWhiteSpace(actor.UserId) ? "unknown" : actor.UserId.Trim(),
                action: "case-study.enfaz-handover.cleared",
                entityType: "WorkOrderProperty",
                entityId: propertyId.ToString("D"),
                before: handoverBefore,
                after: new
                {
                    reason,
                    workOrderId,
                    reopenedStudy = request.ReopenStudy,
                    reopenedValuation = request.ReopenValuation,
                    study = studyOutcome,
                    valuation = valuationOutcome,
                }),
                cancellationToken);
        }

        try
        {
            var poNumber = await db.GetPoNumberAsync(workOrderId, cancellationToken) ?? "";
            await timeline.RecordAsync(
                poNumber,
                propertyId,
                $"enfaz_handover_returned:{now.Ticks}",
                "أُعيدت المعاملة من إنفاذ",
                reason,
                "warn",
                now,
                cancellationToken);
        }
        catch
        {
            // The stamp is already cleared — a missing timeline entry does not undo the return.
        }

        var refreshed = await LoadFactsAsync(workOrderId, propertyId, cancellationToken);
        if (refreshed is null) return (null, Fail("المعاملة غير موجودة"));
        var (freshInput, hasSurvey, freshProperty) = refreshed.Value;
        return (ToDto(workOrderId, propertyId, freshInput, hasSurvey, freshProperty, notices), null);
    }

    private static Dictionary<string, string> Fail(string message) => new() { ["_"] = message };
}
