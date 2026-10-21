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
    IValuationReportReopenCommands? valuationReopen = null,
    ITransactionReferenceService? transactions = null)
    : ITransactionStateService
{
    public const string ReferenceBeforeHandoverAr = "تعذّر تثبيت الرقم المرجعي قبل الرفع — أعد المحاولة";

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

        // Decision 2026-10-20: a deed never goes to Enfaz under a temporary number. The first report
        // approval normally fixed the PR root; this is the safety net for anything that slipped past.
        if (transactions is not null)
        {
            var (_, referenceError) = await transactions.ConfirmOfficialReferenceAsync(
                propertyId, _time.UtcNow(), cancellationToken);
            if (referenceError is not null)
                return (null, $"{ReferenceBeforeHandoverAr} ({referenceError})");
        }

        property.EnfazHandoverAtUtc = _time.UtcNow();
        property.EnfazHandoverByUserId = recordedByUserId;
        await db.SaveChangesAsync(cancellationToken);

        // Time entry in the property file — Complete Delivery Closing event.
        try
        {
            var poNumber = await db.GetPoNumberAsync(workOrderId, cancellationToken) ?? "";
            var handedOverAt = _time.UtcNow();
            await timeline.RecordAsync(
                poNumber,
                propertyId,
                $"enfaz_handover:{handedOverAt.Ticks}",
                "رفع المعاملة على إنفاذ",
                "تقرير التقييم بالنسخة النهائية + تقرير دراسة الحالة + المرفقات",
                PropertyTimelineTones.Done,
                handedOverAt,
                cancellationToken);
        }
        catch
        {
            // The upload itself succeeded — failing the time constraint does not fail the operation.
        }

        var updated = input with { EnfazHandedOver = true };
        return (ToDto(workOrderId, propertyId, updated, hasSurvey, property), null);
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
