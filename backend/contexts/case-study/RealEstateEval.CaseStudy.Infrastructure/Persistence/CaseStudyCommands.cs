using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class CaseStudyCommands : ICaseStudyCommands
{
    private readonly CaseStudyDbContext _caseStudy;
    private readonly TimeProvider _time;

    public CaseStudyCommands(CaseStudyDbContext caseStudy, TimeProvider? time = null)
    {
        _caseStudy = caseStudy;
        _time = time ?? TimeProvider.System;
    }

    public async Task<(string? Reference, string? Error)> AllocateDocumentReferenceAsync(
        string dept,
        string type,
        string dateKey,
        CancellationToken cancellationToken = default)
    {
        var normalizedDept = (dept ?? "").Trim();
        var normalizedType = (type ?? "").Trim();
        var normalizedDate = (dateKey ?? "").Trim();
        if (normalizedDept.Length == 0 || normalizedType.Length == 0 || normalizedDate.Length == 0)
            return (null, "dept, type, and dateKey are required");

        var nowUtc = _time.UtcNow();
        if (_caseStudy.Database.IsNpgsql())
        {
            var id = Guid.NewGuid();
            var rows = await _caseStudy.Database
                .SqlQueryRaw<int>(
                    """
                    INSERT INTO case_study."DocumentReferenceCounters"
                        ("Id", "Dept", "Type", "DateKey", "Seq", "UpdatedAtUtc")
                    VALUES ({0}, {1}, {2}, {3}, 1, {4})
                    ON CONFLICT ("Dept", "Type", "DateKey")
                    DO UPDATE SET
                        "Seq" = case_study."DocumentReferenceCounters"."Seq" + 1,
                        "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc"
                    RETURNING "Seq"
                    """,
                    id,
                    normalizedDept,
                    normalizedType,
                    normalizedDate,
                    nowUtc)
                .ToListAsync(cancellationToken);

            var seq = rows.FirstOrDefault();
            if (seq <= 0)
                return (null, "تعذّر توليد رقم كشف الفوترة.");
            if (seq > 999)
                return (null, "تجاوز عدّاد كشوف الفوترة اليومي الحد الأقصى (999).");
            return ($"{normalizedDept}-{normalizedType}-{normalizedDate}-{seq:D3}", null);
        }

        var counter = await _caseStudy.DocumentReferenceCounters
            .FirstOrDefaultAsync(
                c => c.Dept == normalizedDept && c.Type == normalizedType && c.DateKey == normalizedDate,
                cancellationToken);

        if (counter is null)
        {
            counter = new DocumentReferenceCounter
            {
                Id = Guid.NewGuid(),
                Dept = normalizedDept,
                Type = normalizedType,
                DateKey = normalizedDate,
                Seq = 1,
                UpdatedAtUtc = nowUtc,
            };
            _caseStudy.DocumentReferenceCounters.Add(counter);
        }
        else
        {
            if (counter.Seq >= 999)
                return (null, "تجاوز عدّاد كشوف الفوترة اليومي الحد الأقصى (999).");
            counter.Seq += 1;
            counter.UpdatedAtUtc = nowUtc;
        }

        await _caseStudy.SaveChangesAsync(cancellationToken);
        return ($"{normalizedDept}-{normalizedType}-{normalizedDate}-{counter.Seq:D3}", null);
    }

    public async Task BackfillPropertyAreaIfEmptyAsync(
        Guid propertyId,
        decimal areaM2,
        CancellationToken cancellationToken = default)
    {
        if (areaM2 <= 0m)
            return;

        var property = await _caseStudy.WorkOrderProperties
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
        if (property is null)
            return;
        if (EngineeringSurveyFeeRules.TryParseAreaM2(property.Area, out _))
            return;

        property.Area = areaM2.ToString(System.Globalization.CultureInfo.InvariantCulture);
        await _caseStudy.SaveChangesAsync(cancellationToken);
    }
}

/// <summary>
/// EF implementation of the Failures→Case Study side effects, served on the Case Study
/// host through /api/case-study-dispatch. Logic relocated from FailureService (A9).
/// </summary>
public sealed class CaseStudyFailureCommands : ICaseStudyFailureCommands
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private readonly CaseStudyDbContext _caseStudy;
    private readonly IWorkflowTaskShellPatcher _tasks;
    private readonly IPropertyTimelineService _timeline;
    private readonly TimeProvider _time;

    public CaseStudyFailureCommands(
        CaseStudyDbContext caseStudy,
        IWorkflowTaskShellPatcher tasks,
        IPropertyTimelineService timeline,
        TimeProvider? time = null)
    {
        _caseStudy = caseStudy;
        _tasks = tasks;
        _timeline = timeline;
        _time = time ?? TimeProvider.System;
    }

    public async Task SetFailureDeedStatusAsync(
        SetCaseStudyDeedStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        var order = await _caseStudy.WorkOrders
            .Include(w => w.Properties)
            .FirstOrDefaultAsync(w => w.PoNumber == request.PoNumber.Trim(), cancellationToken);
        if (order is null) return;

        var propertyKey = request.PropertyId.Trim();
        var prop = order.Properties.FirstOrDefault(p =>
            p.Id.ToString() == propertyKey ||
            p.DeedNumber == propertyKey ||
            p.DeedNumber == request.DeedNumber.Trim());
        if (prop is null && Guid.TryParse(propertyKey, out var gid))
            prop = order.Properties.FirstOrDefault(p => p.Id == gid);
        if (prop is null) return;

        prop.DeedStatus = request.DeedStatus;
        await _caseStudy.SaveChangesAsync(cancellationToken);
    }

    public async Task EscalateObstructionAsync(
        EscalateCaseStudyObstructionRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await FindCaseStudyTaskAsync(request.PoNumber, request.PropertyId, cancellationToken);
        if (task is null || task.Status == WorkflowTaskStatus.Completed) return;

        var priorPhase = task.Phase == WorkflowTaskPhase.Obstruction
            ? task.ObstructionPriorPhase?.ToDbValue()
            : task.Phase.ToDbValue();

        await _tasks.PatchAsync(
            task.Id,
            new PatchWorkflowTaskRequest
            {
                Phase = WorkflowTaskPhaseValues.Obstruction,
                ObstructionPriorPhase = priorPhase,
                AssigneeRole = StaffRoleIds.SectionSupervisor,
                AssigneeName = "مشرف دراسة الحالة",
                Status = WorkflowTaskStatusValues.Blocked,
                ObstructionReason = request.Reason.Trim(),
            },
            cancellationToken);
    }

    public async Task ResolveObstructionAsync(
        ResolveCaseStudyObstructionRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await FindCaseStudyTaskAsync(request.PoNumber, request.PropertyId, cancellationToken);
        if (task is null || task.Status == WorkflowTaskStatus.Completed) return;
        if (!TryGetObstructionResumePhase(task, out var resumePhase)) return;

        if (resumePhase == WorkflowTaskPhase.Bourse && task.PropertyId is Guid propertyId)
            await ResetBourseCompletionForPropertyAsync(propertyId, cancellationToken);

        await _tasks.PatchAsync(
            task.Id,
            new PatchWorkflowTaskRequest
            {
                Phase = resumePhase.ToDbValue(),
                AssigneeRole = StaffRoleIds.CaseSpecialist,
                AssigneeName = "أخصائي دراسة الحالة",
                Status = WorkflowTaskStatusValues.Open,
                ObstructionReason = "",
                ObstructionPriorPhase = "",
            },
            cancellationToken);
    }

    public async Task BlockPropertyTasksForFailureAsync(
        BlockCaseStudyTasksForFailureRequest request,
        CancellationToken cancellationToken = default)
    {
        var propertyGuid = await ResolvePropertyGuidAsync(
            request.PoNumber,
            request.PropertyId.Trim(),
            cancellationToken);
        if (!propertyGuid.HasValue) return;

        var po = request.PoNumber.Trim();
        var tasks = await _caseStudy.WorkflowTasks
            .Where(t =>
                t.PoNumber == po &&
                t.PropertyId == propertyGuid &&
                t.Status != WorkflowTaskStatus.Completed)
            .ToListAsync(cancellationToken);

        /* PatchAsync used to SELECT + SaveChanges per task. Blocking does not trigger Patch
           side effects (completion fees need Completed; specialist notify needs Open) —
           applying the shell patch and saving once is literally equivalent. */
        var nowUtc = _time.UtcNow();
        foreach (var task in tasks)
        {
            task.ApplyShellPatch(
                phase: null,
                status: WorkflowTaskStatus.Blocked,
                title: null,
                assigneeRole: null,
                assigneeName: null,
                assigneeId: null,
                assigneeIdProvided: false,
                propertyId: null,
                propertyIdProvided: false,
                obstructionReason: string.IsNullOrWhiteSpace(request.Reason)
                    ? null
                    : request.Reason,
                obstructionReasonProvided: request.Reason is not null,
                obstructionPriorPhase: null,
                obstructionPriorPhaseProvided: false,
                distributionJson: null,
                nowUtc: nowUtc);
        }
        await _caseStudy.SaveChangesAsync(cancellationToken);
    }

    public async Task<CaseStudyHoldTaskResultDto?> BlockTaskForHoldAsync(
        CaseStudyHoldTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await _caseStudy.WorkflowTasks
            .FirstOrDefaultAsync(
                t =>
                    t.Kind == CaseStudyPropertyKind
                    && t.PoNumber == request.PoNumber
                    && t.PropertyId == request.PropertyId
                    && t.Status != WorkflowTaskStatus.Completed
                    && t.Status != WorkflowTaskStatus.Cancelled,
                cancellationToken);
        if (task is null) return null;

        task.Block(request.Reason, _time.UtcNow());
        await _caseStudy.SaveChangesAsync(cancellationToken);
        return new CaseStudyHoldTaskResultDto { TaskId = task.Id, AssigneeId = task.AssigneeId };
    }

    public async Task<CaseStudyHoldTaskResultDto?> UnblockTaskForHoldAsync(
        CaseStudyHoldTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await _caseStudy.WorkflowTasks
            .FirstOrDefaultAsync(
                t =>
                    t.Kind == CaseStudyPropertyKind
                    && t.PoNumber == request.PoNumber
                    && t.PropertyId == request.PropertyId
                    && t.Status == WorkflowTaskStatus.Blocked
                    && t.Phase == WorkflowTaskPhase.Obstruction,
                cancellationToken);
        if (task is null) return null;

        task.Unblock(_time.UtcNow(), WorkflowTaskPhase.Bourse);
        await _caseStudy.SaveChangesAsync(cancellationToken);
        return new CaseStudyHoldTaskResultDto { TaskId = task.Id, AssigneeId = task.AssigneeId };
    }

    public Task RecordPropertyTimelineEventAsync(
        PropertyTimelineRecordRequest request,
        CancellationToken cancellationToken = default) =>
        _timeline.RecordAsync(
            request.PoNumber,
            request.PropertyId,
            request.EventKey,
            request.Title,
            request.Detail,
            request.Tone,
            request.OccurredAtUtc,
            cancellationToken);

    private async Task<WorkflowTask?> FindCaseStudyTaskAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var propertyGuid = await ResolvePropertyGuidAsync(po, propertyId.Trim(), cancellationToken);
        if (!propertyGuid.HasValue) return null;

        return await _caseStudy.WorkflowTasks.FirstOrDefaultAsync(
            t =>
                t.PoNumber == po &&
                t.Kind == CaseStudyPropertyKind &&
                t.Status != WorkflowTaskStatus.Completed &&
                t.PropertyId == propertyGuid,
            cancellationToken);
    }

    private async Task<Guid?> ResolvePropertyGuidAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        if (Guid.TryParse(propertyId, out var guid)) return guid;

        var order = await _caseStudy.WorkOrders
            .Include(w => w.Properties)
            .FirstOrDefaultAsync(w => w.PoNumber == poNumber.Trim(), cancellationToken);
        var prop = order?.Properties.FirstOrDefault(p =>
            p.DeedNumber == propertyId || p.Id.ToString() == propertyId);
        return prop?.Id;
    }

    private static bool TryGetObstructionResumePhase(
        WorkflowTask task,
        out WorkflowTaskPhase resumePhase)
    {
        if (task.Phase == WorkflowTaskPhase.Obstruction)
        {
            resumePhase = task.ObstructionPriorPhase
                ?? (task.PropertyId.HasValue
                    ? WorkflowTaskPhase.Bourse
                    : WorkflowTaskPhase.Enfath);
            return true;
        }

        if (task.Status == WorkflowTaskStatus.Blocked && task.ObstructionPriorPhase.HasValue)
        {
            resumePhase = task.ObstructionPriorPhase.Value;
            return true;
        }

        resumePhase = default;
        return false;
    }

    private async Task ResetBourseCompletionForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var property = await _caseStudy.WorkOrderProperties
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
        if (property is null || !property.BourseDataCompleted) return;

        property.BourseDataCompleted = false;
        property.BourseCompletedAtUtc = null;
        await _caseStudy.SaveChangesAsync(cancellationToken);
    }
}
