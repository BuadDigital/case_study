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
        "ليس لديك صلاحية إعادة فتح المعاملة — إعادة الفتح لأخصائي دراسة الحالة";

    public const string NotHandedOverAr =
        "لم يُودَع التقييم ولم تُرفع المعاملة بعد — قبل الإيداع يسحب المراجع المسودة من المقيّم بدل إعادة الفتح";

    public const string ReopeningActiveAr =
        "للمعاملة إعادة فتح قائمة — أكملها (أعد رفعها على إنفاذ) قبل إعادة فتح جديدة";

    public const string EnfazReferenceRequiredAr = "اكتب رقم ملاحظة إنفاذ أو مرجعها";

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
        if (!PoRoleMatrixRules.CanReopenTransaction(actor.Staff))
            return (null, Fail(ReturnRoleDeniedAr));

        var reason = (request.Reason ?? "").Trim();
        if (reason.Length < MinDecisionReasonLength)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = $"سبب الاسترجاع مطلوب ({MinDecisionReasonLength} أحرف على الأقل)",
            });
        }
        // Field work reopens the study (the inspector's work feeds it); the task is made from the screen.
        var reopenStudy = request.ReopenStudy || request.NeedsFieldWork;
        if (!reopenStudy && !request.ReopenValuation)
            return (null, Fail(ReturnNothingChosenAr));
        var source = string.Equals(request.Source?.Trim(), TransactionReopeningSources.Internal, StringComparison.OrdinalIgnoreCase)
            ? TransactionReopeningSources.Internal
            : TransactionReopeningSources.Enfaz;
        var enfazReference = source == TransactionReopeningSources.Enfaz ? request.EnfazReference?.Trim() : null;
        if (source == TransactionReopeningSources.Enfaz && request.Source is not null && string.IsNullOrEmpty(enfazReference))
            return (null, new Dictionary<string, string> { ["enfazReference"] = EnfazReferenceRequiredAr });

        var facts = await LoadFactsAsync(workOrderId, propertyId, cancellationToken);
        if (facts is null) return (null, Fail("المعاملة غير موجودة"));
        var (input, _, property) = facts.Value;
        // Omar 2026-11-05: after review approved — the valuation deposited, or the transaction uploaded.
        if (!input.EnfazHandedOver && !input.ValuationReportClosed) return (null, Fail(NotHandedOverAr));
        if (property.TransactionId != Guid.Empty
            && await db.GetActiveReopeningAsync(property.TransactionId, cancellationToken) is not null)
            return (null, Fail(ReopeningActiveAr));
        // Billing-ready guard. How it works: a deed the accountant marked «جاهز للفوترة» has its figures on
        // Enfaz, and Enfaz itself no longer takes modification requests for it, so it is refused here.
        // Edge cases: it sits BEFORE the valuation reopen and every stamp clear on purpose — those steps
        // make a retry safe by clearing first and restoring on failure, and a refusal after them would
        // have to undo real changes. An unmarked deed (including one handed over but not yet marked)
        // returns as before.
        if (property.IsBillingReady) return (null, Fail(BillingReadyBlocksReturnAr));

        var handoverBefore = new
        {
            at = property.EnfazHandoverAtUtc,
            by = property.EnfazHandoverByUserId,
        };
        var notices = new List<string>();
        var studyOutcome = "not_requested";

        // The transaction leaves review's approval: its data and reports are edited again (Omar 2026-11-05).
        if (transactions is not null)
            await transactions.SetReviewStateAsync(
                propertyId, TransactionReviewStates.Study, actor.UserId, _time.UtcNow(), cancellationToken);
        var valuationOutcome = "not_requested";

        // The valuation first: a deposited report reopens as a new version (Valuation also reopens the appraiser's
        // package and task). The order makes a retry safe: if the study part is refused afterwards, the report is no
        // longer deposited on the retry and only the study reopen is repeated.
        if (request.ReopenValuation && input.ValuationReportClosed)
        {
            if (valuationReopen is null)
                return (null, Fail("تعذّر فتح تقرير التقييم بنسخة جديدة الآن — أعد المحاولة"));

            // A delivered transaction refuses every party reopen (the appraiser's package included), so the
            // stamp comes off before the cross-service call — and goes back on if Valuation refuses, which
            // keeps the retry path («المعاملة مرفوعة») intact.
            property.ClearEnfazHandover();
            await db.SaveChangesAsync(cancellationToken);

            var (reopened, reopenError) = await valuationReopen.ReopenDepositedReportAsync(
                propertyId, reason, cancellationToken);
            if (!reopened)
            {
                property.EnfazHandoverAtUtc = handoverBefore.at;
                property.EnfazHandoverByUserId = handoverBefore.by;
                await db.SaveChangesAsync(cancellationToken);
                return (null, Fail(reopenError ?? "تعذّر فتح تقرير التقييم بنسخة جديدة"));
            }

            valuationOutcome = "reopened_new_version";
            notices.Add("أُعيد فتح تقرير التقييم بنسخة جديدة — يعيد المقيّم تقييمه ثم يُعدّ الأخصائي المسودة ويودع من جديد");
        }

        if (reopenStudy)
        {
            var parent = (await db.ListPropertyTasksAsync(propertyId, cancellationToken))
                .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty)
                .OrderByDescending(t => t.CreatedAtUtc)
                .FirstOrDefault();
            if (parent is null || caseStudyReports is null)
                return (null, Fail("تعذّر تحديد مهمة دراسة الحالة لإعادة فتح تقريرها"));

            // Reopening with clearEnfazHandover clears the stamp inside the report's own transaction. Any
            // specialist reopens the transaction (Omar 2026-11-05), so the study reopen runs on its authority.
            var studyActor = actor.Staff.HoldsStudy
                ? actor
                : new CaseStudyReportActor
                {
                    UserId = actor.UserId,
                    DisplayName = actor.DisplayName,
                    // The supervisor / CDO reopen as a study holder for this one step (the audit keeps the user id).
                    PrototypeRole = StaffRoleIds.CaseSpecialist,
                    DistributionAssigneeId = actor.DistributionAssigneeId,
                    SubRoles = [.. actor.SubRoles, CaseSpecialistSubRoles.Study],
                };
            var (reopened, errors) = await caseStudyReports.ReopenAsync(
                parent.Id, reason, clearEnfazHandover: true, studyActor, cancellationToken);
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
        if (input.EnfazHandedOver) notices.Insert(0, "مُسح ختم التسليم على إنفاذ");

        // The reopening itself: it ends when the transaction goes back to Enfaz (Omar 2026-11-05).
        if (current.TransactionId != Guid.Empty)
        {
            db.AddReopening(new TransactionReopening
            {
                Id = Guid.NewGuid(),
                TransactionId = current.TransactionId,
                PropertyId = propertyId,
                Source = source,
                EnfazReference = string.IsNullOrEmpty(enfazReference) ? null : enfazReference,
                Reason = reason,
                ReopensStudy = reopenStudy,
                ReopensValuation = request.ReopenValuation,
                NeedsFieldWork = request.NeedsFieldWork,
                Status = TransactionReopeningStatuses.Open,
                OpenedAtUtc = now,
                OpenedByUserId = string.IsNullOrWhiteSpace(actor.UserId) ? null : actor.UserId.Trim(),
                OpenedByName = string.IsNullOrWhiteSpace(actor.DisplayName) ? null : actor.DisplayName.Trim(),
            });
            await db.SaveChangesAsync(cancellationToken);
        }
        if (request.NeedsFieldWork)
            notices.Add("أنشئ مهمة للعمل الميداني المطلوب (إعادة تصوير أو زيارة) من «مهمة تشغيلية»");

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
                    reopenedStudy = reopenStudy,
                    source,
                    enfazReference,
                    needsFieldWork = request.NeedsFieldWork,
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
                source == TransactionReopeningSources.Enfaz ? "أُعيد فتح المعاملة بملاحظة من إنفاذ" : "أُعيد فتح المعاملة",
                string.IsNullOrEmpty(enfazReference) ? reason : $"{enfazReference} — {reason}",
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
        return (await WithReopeningAsync(
            ToDto(workOrderId, propertyId, freshInput, hasSurvey, freshProperty, notices),
            freshInput,
            freshProperty,
            cancellationToken), null);
    }

    private static Dictionary<string, string> Fail(string message) => new() { ["_"] = message };
}
