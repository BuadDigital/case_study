using RealEstateEval.Application;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed partial class ValuationReportIssuanceService
{
    public const string NoCodeYetCannotReopenAr =
        "لم يُسجَّل رمز الإيداع بعد — يسحب المقيّم اعتماده بدل فتح نسخة جديدة";

    public const string ReopenUnavailableAr =
        "تعذّر الوصول لدراسة الحالة لإعادة فتح تقييم المقيّم — أعد المحاولة بعد قليل";

    /// <summary>
    /// A deposited report (deposit code recorded) is reopened as a new version (n+1): the appraiser's package
    /// and task open again in Case Study FIRST (idempotent there), then the current copy is superseded and the
    /// request reopens. A retry after a failed second step finds the package already returned and goes on.
    /// </summary>
    public async Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        ReopenAfterDepositAsync(
            Guid valuationRequestId,
            ReopenReportIssuanceRequest request,
            string? requestedByUserId,
            CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });

        var row = await db.ValuationReportIssuances
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
        if (row is null)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا نسخة إيداع سارية — الرجوع قبل الإيداع يمر عبر استدعاء المهمة (ر1)",
            });
        }

        // Only a recorded deposit is a new version; before the code the appraiser takes his approval back.
        if (string.IsNullOrWhiteSpace(row.DepositCode) && row.FinalIssuedAtUtc is null)
            return (null, new Dictionary<string, string> { ["_"] = NoCodeYetCannotReopenAr });

        // Checked before anything moves in Case Study: a refused reason must leave both services untouched.
        if (!JustificationRules.IsAcceptable(request.Reason))
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = JustificationRules.TooShortMessageAr("سبب إعادة الفتح"),
            });
        }

        var (reopenError, appraisalTaskId) = await ReopenAppraiserPackageAsync(vr.PropertyId, request.Reason, cancellationToken);
        if (reopenError is not null)
            return (null, new Dictionary<string, string> { ["_"] = reopenError });

        // R2: deposited copy is not edited — marked superseded and kept on file; the new cycle ends
        // with deposit copy N+1 and a new Qiama deposit.
        var error = row.Supersede(requestedByUserId, request.Reason, _time.UtcNow());
        if (error is not null)
            return (null, new Dictionary<string, string> { ["reason"] = error });

        // Reverses professional-step completion — request reopens and holds the property until the new cycle.
        vr.ReopenReport(_time.UtcNow());

        // The reopen starts a new cycle on the appraiser's desk — Platform resolves the property's
        // appraiser and writes the inbox row (Valuation has no assignee directory of its own).
        // Staged before the save: the publisher only adds the outbox row to this context.
        if (events is not null)
        {
            var reopenReason = (request.Reason ?? "").Trim();
            await events.PublishAsync(
                IntegrationEventTypes.ValuationWorkflowNotice,
                new ValuationWorkflowNoticePayload(
                    vr.PropertyId.ToString("D"),
                    ValuationNoticeAudiences.Appraiser,
                    "إعادة فتح إصدار التقرير",
                    reopenReason.Length == 0
                        ? "أُعيد فتح إصدار التقرير بعد الإيداع — تبدأ دورة إصدار جديدة."
                        : $"أُعيد فتح إصدار التقرير بعد الإيداع: {reopenReason}",
                    NotificationContract.Tones.Warn,
                    appraisalTaskId is { } taskId
                        ? $"/property-appraisal/{Uri.EscapeDataString(taskId.ToString("D"))}"
                        : "/property-appraisal"),
                cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);

        // 2-B: every reopen leaves an audit entry with actor and reason — best-effort after the main save.
        if (audit is not null && auditLog is not null)
        {
            await auditLog.AppendAsync(audit.Create(
                actorId: string.IsNullOrWhiteSpace(requestedByUserId) ? "unknown" : requestedByUserId,
                action: "valuation.report-issuance.reopened",
                entityType: "ValuationReportIssuance",
                entityId: valuationRequestId.ToString("D"),
                before: new { row.Version, stage = ReportIssuanceStages.DepositIssued },
                after: new { reason = row.SupersededReason, nextVersion = row.Version + 1 }),
                cancellationToken);
        }

        return (await GetStateAsync(valuationRequestId, cancellationToken), null);
    }

    /// <summary>
    /// The appraiser's package goes back to him and his task opens again. Skipped when Case Study is not
    /// wired (tests) or the property has no appraisal task; a refusal or an outage stops the reopen.
    /// </summary>
    private async Task<(string? Error, Guid? AppraisalTaskId)> ReopenAppraiserPackageAsync(
        Guid propertyId,
        string? reason,
        CancellationToken cancellationToken)
    {
        if (caseStudyCommands is null || caseStudy is null || propertyId == Guid.Empty)
            return (null, null);

        try
        {
            var tasks = await caseStudy.ListWorkflowTasksByPropertyAsync(
                propertyId, [WorkflowTaskKind.PropertyAppraisal], cancellationToken);
            var task = tasks
                .Where(t => !string.Equals(t.Status, WorkflowTaskStatusValues.Cancelled, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(t => t.UpdatedAtUtc)
                .FirstOrDefault();
            if (task is null) return (null, null);

            var (_, error) = await caseStudyCommands.ReopenAppraisalForNewVersionAsync(
                task.Id, reason, cancellationToken);
            return (error, task.Id);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException
            && !cancellationToken.IsCancellationRequested)
        {
            return (ReopenUnavailableAr, null);
        }
    }
}
