using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// ق-9: يجمع وقائع المعاملة (مهمة دراسة الحالة الأم وأطرافها + إقفال تقرير التقييم ق-6
/// + رفع إنفاذ) ويشتق الحالة عبر <see cref="TransactionStateRules"/> — الشاشة تعرض من
/// ينتظر من.
/// </summary>
public sealed class TransactionStateService(
    ICaseStudyRepository db,
    IValuationRequestService valuationRequests,
    IPropertyTimelineService timeline,
    TimeProvider? time = null)
    : ITransactionStateService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

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
            return (null, "المعاملة مرفوعة على إنفاذ سلفاً");
        if (!TransactionStateRules.AllowsEnfazHandover(input))
        {
            return (null,
                "رفع إنفاذ لا يقع قبل شهادة الإيداع (ق-6) واكتمال كل الأطراف — "
                + "راجع شبكة الحالة");
        }

        property.EnfazHandoverAtUtc = _time.UtcNow();
        property.EnfazHandoverByUserId = recordedByUserId;
        await db.SaveChangesAsync(cancellationToken);

        // قيد زمني في ملف العقار — التسليم الشامل حدث ختامي.
        try
        {
            var poNumber = await db.WorkOrders.AsNoTracking()
                .Where(w => w.Id == workOrderId)
                .Select(w => w.PoNumber)
                .FirstOrDefaultAsync(cancellationToken) ?? "";
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
            // الرفع نفسه نجح — تعذّر القيد الزمني لا يفشل العملية.
        }

        var updated = input with { EnfazHandedOver = true };
        return (ToDto(workOrderId, propertyId, updated, hasSurvey, property), null);
    }

    private async Task<(TransactionStateRules.Input Input, bool HasSurvey, WorkOrderProperty Property)?>
        LoadFactsAsync(Guid workOrderId, Guid propertyId, CancellationToken cancellationToken)
    {
        var property = await db.WorkOrderProperties
            .FirstOrDefaultAsync(
                p => p.Id == propertyId && p.WorkOrderId == workOrderId,
                cancellationToken);
        if (property is null) return null;

        var tasks = await db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PropertyId == propertyId)
            .ToListAsync(cancellationToken);

        var parent = tasks
            .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefault();

        TransactionStateRules.PartyFacts FactsFor(WorkflowTaskKind kind)
        {
            var task = tasks
                .Where(t => t.Kind == kind && t.Status != WorkflowTaskStatus.Cancelled)
                .OrderByDescending(t => t.CreatedAtUtc)
                .FirstOrDefault();
            return new TransactionStateRules.PartyFacts(
                Assigned: task?.AssigneeId is not null || task is not null,
                Completed: task?.Status == WorkflowTaskStatus.Completed);
        }

        var surveyTask = tasks.Any(t =>
            t.Kind == WorkflowTaskKind.EngineeringSurvey
            && t.Status != WorkflowTaskStatus.Cancelled);

        // ق-6: إقفال تقرير التقييم = المقيم أكمل ولا طلب تقييم مفتوحاً على العقار.
        var appraiser = FactsFor(WorkflowTaskKind.PropertyAppraisal);
        var openValuation = appraiser.Completed
            ? await valuationRequests.GetOpenByPropertyAsync(
                propertyId.ToString(), cancellationToken)
            : null;
        var valuationClosed = appraiser.Completed && openValuation is null;

        var input = new TransactionStateRules.Input(
            ParentPhase: (parent?.Phase ?? WorkflowTaskPhase.Enfath).ToDbValue(),
            Inspector: FactsFor(WorkflowTaskKind.FieldInspection),
            Appraiser: appraiser,
            EngineeringOffice: surveyTask
                ? FactsFor(WorkflowTaskKind.EngineeringSurvey)
                : null,
            CaseSpecialist: new TransactionStateRules.PartyFacts(
                Assigned: parent is not null,
                Completed: parent?.Status == WorkflowTaskStatus.Completed),
            ValuationReportClosed: valuationClosed,
            EnfazHandedOver: property.EnfazHandoverAtUtc is not null);

        return (input, surveyTask, property);
    }

    private static TransactionStateDto ToDto(
        Guid workOrderId,
        Guid propertyId,
        TransactionStateRules.Input input,
        bool hasSurvey,
        WorkOrderProperty property)
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
            EnfazHandoverAtUtc = property.EnfazHandoverAtUtc?.ToString("o"),
            HandoverPackageAr = TransactionStateRules.HandoverPackageAr(hasSurvey),
        };
    }
}
