using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Q-9: Collects transaction facts (parent case study task and its parties + closing Valuation Report Q-6
/// + Raise Enfaz) and derive the state via <see cref="TransactionStateRules"/> — the screen displays from
/// Waiting for who?
/// </summary>
public sealed partial class TransactionStateService(
    ITransactionStateRepository db,
    IValuationRequestService valuationRequests,
    IPropertyTimelineService timeline,
    TimeProvider? time = null,
    IAuditLogWriter? audit = null,
    IAuditLogAppend? auditLog = null,
    ICaseStudyReportService? caseStudyReports = null,
    IValuationReportReopenCommands? valuationReopen = null)
    : ITransactionStateService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

 /// <summary>R3 is consistent with Q-8-2: Reason for Decision is at least 10 characters (JustificationRules in evaluation context).</summary>
    private const int MinDecisionReasonLength = 10;

    public async Task<TransactionStateDto?> GetStateAsync(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var facts = await LoadFactsAsync(workOrderId, propertyId, cancellationToken);
        if (facts is null) return null;
        return ToDto(workOrderId, propertyId, facts.Value.Input, facts.Value.HasSurvey, facts.Value.Property);
    }

    public async Task<(TransactionStateDto? Result, string? Error)> RecordEnfazHandoverAsync(
        Guid workOrderId,
        Guid propertyId,
        string? recordedByUserId,
        CancellationToken cancellationToken = default)
    {
        var facts = await LoadFactsAsync(workOrderId, propertyId, cancellationToken);
        if (facts is null) return (null, "المعاملة غير موجودة");

        var (input, hasSurvey, property) = facts.Value;
        if (input.EnfazHandedOver)
            return (null, TransactionStateRules.AlreadyHandedOverAr);
        var blockReasons = TransactionStateRules.EnfazHandoverBlockReasonsAr(input);
        if (blockReasons.Count > 0)
            return (null, EnfazHandoverBlockedAr(blockReasons));

        property.EnfazHandoverAtUtc = _time.UtcNow();
        property.EnfazHandoverByUserId = recordedByUserId;
        await db.SaveChangesAsync(cancellationToken);

        // Time entry in the property file — Complete Delivery Closing event.
        try
        {
            var poNumber = await db.GetPoNumberAsync(workOrderId, cancellationToken) ?? "";
            await timeline.RecordAsync(
                poNumber,
                propertyId,
                "enfaz_handover",
                "رُفعت المعاملة على إنفاذ (التسليم الشامل — ق-9)",
                "تقرير التقييم بالنسخة النهائية + تقرير دراسة الحالة + المرفقات",
                "success",
                _time.UtcNow(),
                cancellationToken);
        }
        catch
        {
            // The upload itself succeeded — failing the time constraint does not fail the operation.
        }

        var updated = input with { EnfazHandedOver = true };
        return (ToDto(workOrderId, propertyId, updated, hasSurvey, property), null);
    }

    public async Task<string?> RecordPostEnfazDecisionAsync(
        Guid workOrderId,
        Guid propertyId,
        PostEnfazDecisionRequest request,
        string? actorId,
        string? actorRole,
        CancellationToken cancellationToken = default)
    {
        if (!TransactionStateRules.AllowsPostEnfazDecision(actorRole))
            return "تسجيل قرار ما بعد إنفاذ للمدير العام حصراً (ر3)";

        var decision = request.Decision.Trim();
        if (decision.Length == 0)
            return "القرار مطلوب";
        if (request.Reason.Trim().Length < MinDecisionReasonLength)
            return $"سبب القرار أقصر من الحد الأدنى ({MinDecisionReasonLength} أحرف) — اكتب سبباً جوهرياً (ق-8)";

        var facts = await LoadFactsAsync(workOrderId, propertyId, cancellationToken);
        if (facts is null) return "المعاملة غير موجودة";
        if (!facts.Value.Input.EnfazHandedOver)
            return "المعاملة لم تُرفع على إنفاذ — الرجوع قبل الرفع يمر عبر ر1/ر2";

        if (audit is null || auditLog is null)
            return "خدمة التدقيق غير متاحة — تعذّر تسجيل القيد";

        // Audit Entry only — the system does not open anything; An actual retrieval is treated as a replay transaction (R2).
        await auditLog.AppendAsync(audit.Create(
            actorId: string.IsNullOrWhiteSpace(actorId) ? "unknown" : actorId,
            action: "case-study.post-enfaz-decision.recorded",
            entityType: "WorkOrderProperty",
            entityId: propertyId.ToString("D"),
            before: null,
            after: new { decision, reason = request.Reason.Trim(), workOrderId }),
            cancellationToken);
        return null;
    }

    private async Task<(TransactionStateRules.Input Input, bool HasSurvey, WorkOrderProperty Property)?>
        LoadFactsAsync(Guid workOrderId, Guid propertyId, CancellationToken cancellationToken)
    {
        var property = await db.GetPropertyAsync(workOrderId, propertyId, cancellationToken);
        if (property is null) return null;

        var tasks = await db.ListPropertyTasksAsync(propertyId, cancellationToken);

        var parent = tasks
            .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefault();
        var appraisalTask = TransactionStateInputBuilder.LatestTask(tasks, WorkflowTaskKind.PropertyAppraisal);

        // Handed over to the specialist but not yet completed (the task completes at the final issuance).
        var appraiserSubmitted = appraisalTask is { Status: not WorkflowTaskStatus.Completed }
            && await db.IsPartyPackageSubmittedAsync(appraisalTask.Id, cancellationToken);
        var studyReportIssued = parent is not null
            && await db.IsCaseStudyReportIssuedAsync(parent.Id, cancellationToken);

        var input = TransactionStateInputBuilder.Build(
            tasks,
            enfazHandedOver: property.EnfazHandoverAtUtc is not null,
            studyReportIssued: studyReportIssued,
            appraiserSubmitted: appraiserSubmitted);

        // Q-6: Valuation Report closure = the appraiser completed and no Valuation Request remains open for the property.
        if (input.Appraiser.Completed)
        {
            var openValuation = await valuationRequests.GetOpenByPropertyAsync(
                propertyId.ToString(), cancellationToken);
            input = input with { ValuationReportClosed = openValuation is null };
        }

        var surveyTask = input.EngineeringOffice is not null;

        return (input, surveyTask, property);
    }

    private static TransactionStateDto ToDto(
        Guid workOrderId,
        Guid propertyId,
        TransactionStateRules.Input input,
        bool hasSurvey,
        WorkOrderProperty property,
        IReadOnlyList<string>? returnNoticesAr = null)
    {
        var result = TransactionStateRules.Evaluate(input);
        return new TransactionStateDto
        {
            WorkOrderId = workOrderId,
            PropertyId = propertyId,
            Stages = result.Stages
                .Select(s => new TransactionStageStateDto
                {
                    Key = s.Key,
                    LabelAr = s.LabelAr,
                    Status = s.Status,
                    StatusLabelAr = TransactionStateRules.Statuses.LabelAr(s.Status),
                })
                .ToList(),
            Parties = result.Parties
                .Select(p => new TransactionPartyStateDto
                {
                    Key = p.Key,
                    LabelAr = p.LabelAr,
                    Status = p.Status,
                    StatusLabelAr = TransactionStateRules.Statuses.LabelAr(p.Status),
                    WaitingOn = p.WaitingOn,
                    WaitingOnLabelsAr = p.WaitingOn
                        .Select(TransactionStateRules.Parties.LabelAr)
                        .ToList(),
                })
                .ToList(),
            OverallStatus = result.OverallStatus,
            OverallStatusLabelAr = TransactionStateRules.Statuses.LabelAr(result.OverallStatus),
            WaitingSummaryAr = result.WaitingSummaryAr,
            AllowsEnfazHandover = TransactionStateRules.AllowsEnfazHandover(input),
            StudyReportIssued = input.StudyReportIssued,
            EnfazBlockReasonsAr = input.EnfazHandedOver
                ? []
                : TransactionStateRules.EnfazHandoverBlockReasonsAr(input),
            EnfazReturnNoticesAr = returnNoticesAr ?? [],
            EnfazHandoverAtUtc = property.EnfazHandoverAtUtc?.ToString("o"),
            HandoverPackageAr = TransactionStateRules.HandoverPackageAr(hasSurvey),
        };
    }
}
