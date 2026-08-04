using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PropertyTimelineService : IPropertyTimelineService
{
    private const int MaxTimelineRows = 500;

    private readonly CaseStudyDbContext _caseStudy;
    private readonly FailuresDbContext _failures;

    public PropertyTimelineService(CaseStudyDbContext caseStudy, FailuresDbContext failures)
    {
        _caseStudy = caseStudy;
        _failures = failures;
    }

    public async Task<IReadOnlyList<PropertyTimelineEventDto>> GetForPropertyAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var existing = await _caseStudy.PropertyTimelineEntries
            .AsNoTracking()
            .Where(e => e.PoNumber == po && e.PropertyId == propertyId)
            .OrderByDescending(e => e.OccurredAtUtc)
            .ThenBy(e => e.EventKey)
            .Take(MaxTimelineRows)
            .ToListAsync(cancellationToken);

        if (existing.Count == 0)
        {
            var bootstrapped = await BootstrapAsync(po, propertyId, cancellationToken);
            if (bootstrapped.Count > 0)
            {
                _caseStudy.PropertyTimelineEntries.AddRange(bootstrapped);
                await _caseStudy.SaveChangesAsync(cancellationToken);
                existing = bootstrapped;
            }
        }

        var (parent, children) = await LoadPartyTasksAsync(po, propertyId, cancellationToken);
        return existing
            .OrderBy(e => e.OccurredAtUtc)
            .ThenBy(e => e.EventKey)
            .Select(e => ToDto(ApplyDynamicTone(e, parent, children)))
            .ToList();
    }

    private async Task<(WorkflowTask? Parent, List<WorkflowTask> Children)> LoadPartyTasksAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var tasks = await _caseStudy.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.PoNumber == poNumber && t.PropertyId == propertyId)
            .ToListAsync(cancellationToken);

        var parent = tasks.FirstOrDefault(t => t.Kind == WorkflowTaskKind.CaseStudyProperty);
        var children = parent is null
            ? []
            : tasks.Where(t => t.ParentTaskId == parent.Id).ToList();
        return (parent, children);
    }

    private static PropertyTimelineEntry ApplyDynamicTone(
        PropertyTimelineEntry entry,
        WorkflowTask? parent,
        IReadOnlyList<WorkflowTask> children)
    {
        if (entry.EventKey.StartsWith("party:", StringComparison.Ordinal) &&
            entry.EventKey.EndsWith(":assigned", StringComparison.Ordinal))
        {
            const string assignedSuffix = ":assigned";
            var inner = entry.EventKey["party:".Length..^assignedSuffix.Length];
            if (Guid.TryParse(inner, out var taskId))
            {
                var child = children.FirstOrDefault(c => c.Id == taskId);
                if (child is not null)
                {
                    entry.Tone = child.Status == WorkflowTaskStatus.Completed ? "done" : "active";
                }
            }
        }
        else if (entry.EventKey.Contains(":distribution", StringComparison.Ordinal) && children.Count > 0)
        {
            entry.Tone = children.All(c => c.Status == WorkflowTaskStatus.Completed)
                ? "done"
                : "active";
        }
        else if (entry.EventKey.StartsWith("failure:", StringComparison.Ordinal) &&
                 entry.EventKey.EndsWith(":created", StringComparison.Ordinal))
        {
            entry.Tone = "warn";
        }
        else if (entry.EventKey.EndsWith(":case-study", StringComparison.Ordinal) && parent is not null)
        {
            entry.Tone = IsCaseStudyComplete(parent) ? "done" : "active";
        }

        return entry;
    }

    private static bool IsCaseStudyComplete(WorkflowTask parent) =>
        parent.Status == WorkflowTaskStatus.Completed || parent.Phase == WorkflowTaskPhase.Done;

    public async Task RecordAsync(
        string poNumber,
        Guid propertyId,
        string eventKey,
        string title,
        string? detail,
        string tone,
        DateTime occurredAtUtc,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var key = eventKey.Trim();
        if (string.IsNullOrEmpty(po) || string.IsNullOrEmpty(key)) return;

        var exists = await _caseStudy.PropertyTimelineEntries.AnyAsync(
            e => e.PoNumber == po && e.PropertyId == propertyId && e.EventKey == key,
            cancellationToken);
        if (exists) return;

        var now = DateTime.UtcNow;
        _caseStudy.PropertyTimelineEntries.Add(new PropertyTimelineEntry
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            PropertyId = propertyId,
            EventKey = key,
            Title = title.Trim(),
            Detail = string.IsNullOrWhiteSpace(detail) ? null : detail.Trim(),
            Tone = NormalizeTone(tone),
            OccurredAtUtc = occurredAtUtc,
            RecordedAtUtc = now,
        });
        await _caseStudy.SaveChangesAsync(cancellationToken);
    }

    public async Task RecordManyAsync(
        IReadOnlyList<PropertyTimelineRecordRequest> events,
        CancellationToken cancellationToken = default)
    {
        if (events.Count == 0) return;

        var normalized = events
            .Select(e => new
            {
                Po = e.PoNumber.Trim(),
                e.PropertyId,
                Key = e.EventKey.Trim(),
                e.Title,
                e.Detail,
                e.Tone,
                e.OccurredAtUtc,
            })
            .Where(e => !string.IsNullOrEmpty(e.Po) && !string.IsNullOrEmpty(e.Key))
            .ToList();
        if (normalized.Count == 0) return;

        var poNumbers = normalized.Select(e => e.Po).Distinct().ToList();
        var propertyIds = normalized.Select(e => e.PropertyId).Distinct().ToList();
        var existingKeys = await _caseStudy.PropertyTimelineEntries
            .AsNoTracking()
            .Where(e => poNumbers.Contains(e.PoNumber) && propertyIds.Contains(e.PropertyId))
            .Select(e => new { e.PoNumber, e.PropertyId, e.EventKey })
            .ToListAsync(cancellationToken);
        var existing = existingKeys
            .Select(e => (e.PoNumber, e.PropertyId, e.EventKey))
            .ToHashSet();

        var now = DateTime.UtcNow;
        foreach (var entry in normalized)
        {
            if (existing.Contains((entry.Po, entry.PropertyId, entry.Key)))
                continue;

            _caseStudy.PropertyTimelineEntries.Add(new PropertyTimelineEntry
            {
                Id = Guid.NewGuid(),
                PoNumber = entry.Po,
                PropertyId = entry.PropertyId,
                EventKey = entry.Key,
                Title = entry.Title.Trim(),
                Detail = string.IsNullOrWhiteSpace(entry.Detail) ? null : entry.Detail.Trim(),
                Tone = NormalizeTone(entry.Tone),
                OccurredAtUtc = entry.OccurredAtUtc,
                RecordedAtUtc = now,
            });
            existing.Add((entry.Po, entry.PropertyId, entry.Key));
        }

        await _caseStudy.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<PropertyTimelineEntry>> BootstrapAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var events = new List<PropertyTimelineEntry>();
        var recordedAt = DateTime.UtcNow;

        var order = await _caseStudy.WorkOrders
            .AsNoTracking()
            .Include(w => w.Properties)
            .FirstOrDefaultAsync(w => w.PoNumber == poNumber, cancellationToken);
        if (order is null) return events;

        var property = order.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (property is null) return events;

        AddEvent(
            events,
            poNumber,
            propertyId,
            "enfath",
            "استلام من إنفاذ",
            string.IsNullOrWhiteSpace(order.AssignmentSpecialist)
                ? null
                : $"أخصائي الإسناد: {order.AssignmentSpecialist.Trim()}",
            "done",
            DateOnlyToUtc(order.ReceivedFromEnfathAt),
            recordedAt);

        AddEvent(
            events,
            poNumber,
            propertyId,
            "due",
            "موعد الاستحقاق",
            null,
            "muted",
            DateOnlyToUtc(order.DueDateAt),
            recordedAt);

        var tasks = await _caseStudy.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.PoNumber == poNumber && t.PropertyId == propertyId)
            .OrderBy(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var parent = tasks.FirstOrDefault(t => t.Kind == WorkflowTaskKind.CaseStudyProperty);
        if (parent is not null)
        {
            AddEvent(
                events,
                poNumber,
                propertyId,
                $"task:{parent.Id}:created",
                "إنشاء مهمة العقار",
                TaskPhaseLabel(parent.Phase),
                parent.Status == WorkflowTaskStatus.Completed ? "done" : "active",
                parent.CreatedAtUtc,
                recordedAt);

            if (property.BourseDataCompleted)
            {
                var bourseAt = property.BourseCompletedAtUtc ?? parent.CreatedAtUtc;
                var location = string.Join(
                    " · ",
                    new[] { property.City, property.District }
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .Select(s => s.Trim()));
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    "property-bourse",
                    "بيانات البورصة للعقار",
                    string.IsNullOrEmpty(location) ? null : location,
                    "done",
                    bourseAt,
                    recordedAt);

                if (parent.Phase is not WorkflowTaskPhase.Enfath and not WorkflowTaskPhase.Bourse)
                {
                    AddEvent(
                        events,
                        poNumber,
                        propertyId,
                        $"task:{parent.Id}:bourse-complete",
                        "اكتمال استعلام البورصة",
                        null,
                        "done",
                        bourseAt,
                        recordedAt);
                }
            }

            var children = tasks
                .Where(t => t.ParentTaskId == parent.Id)
                .ToList();
            if (children.Count > 0)
            {
                var distributionAt = children.Min(c => c.CreatedAtUtc);
                var distributionDone = children.All(c => c.Status == WorkflowTaskStatus.Completed);
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"task:{parent.Id}:distribution",
                    "توزيع المعاملة",
                    null,
                    distributionDone ? "done" : "active",
                    distributionAt,
                    recordedAt);

                foreach (var child in children)
                {
                    AddEvent(
                        events,
                        poNumber,
                        propertyId,
                        $"party:{child.Id}:assigned",
                        PartyAssignedTitle(child.Kind),
                        child.AssigneeName,
                        child.Status == WorkflowTaskStatus.Completed ? "done" : "active",
                        child.CreatedAtUtc,
                        recordedAt);
                }
            }

            if (parent.Phase is WorkflowTaskPhase.CaseStudy or WorkflowTaskPhase.Done)
            {
                var caseStudyAt = children.Count > 0
                    ? children.Max(c => c.CreatedAtUtc)
                    : parent.UpdatedAtUtc;
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"task:{parent.Id}:case-study",
                    "دراسة حالة العقار",
                    parent.AssigneeName,
                    IsCaseStudyComplete(parent) ? "done" : "active",
                    caseStudyAt,
                    recordedAt);
            }

            if (parent.Status == WorkflowTaskStatus.Blocked
                || parent.Phase == WorkflowTaskPhase.Obstruction)
            {
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"task:{parent.Id}:blocked",
                    "تعذر / إيقاف",
                    parent.ObstructionReason,
                    "warn",
                    parent.UpdatedAtUtc,
                    recordedAt);
            }

            var childIds = children.Select(c => c.Id).ToList();
            if (childIds.Count > 0)
            {
                var submissions = await _caseStudy.PartyTaskSubmissions
                    .AsNoTracking()
                    .Where(s => childIds.Contains(s.WorkflowTaskId))
                    .ToListAsync(cancellationToken);

                foreach (var submission in submissions)
                {
                    if (submission.Status != PartyTaskSubmissionStatus.Submitted ||
                        !submission.SubmittedAtUtc.HasValue)
                    {
                        continue;
                    }

                    var child = children.FirstOrDefault(c => c.Id == submission.WorkflowTaskId);
                    AddEvent(
                        events,
                        poNumber,
                        propertyId,
                        $"party:{submission.WorkflowTaskId}:submitted",
                        PartySubmittedTitle(submission.Kind),
                        child?.AssigneeName,
                        "done",
                        submission.SubmittedAtUtc.Value,
                        recordedAt);
                }
            }

            var caseStudyForm = await _caseStudy.CaseStudyForms
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.TaskId == parent.Id && !f.IsPartyForm, cancellationToken);
            if (caseStudyForm is not null &&
                caseStudyForm.Status is CaseStudyFormStatuses.Submitted
                    or CaseStudyFormStatuses.Completed
                    or CaseStudyFormStatuses.Done)
            {
                var formAt = caseStudyForm.SavedAtUtc ?? caseStudyForm.UpdatedAtUtc;
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"case-study-form:{parent.Id}",
                    "إرسال نموذج دراسة الحالة",
                    null,
                    "done",
                    formAt,
                    recordedAt);
            }
        }

        var propertyKey = propertyId.ToString();
        var failures = await _failures.PropertyFailures
            .AsNoTracking()
            .Where(f => f.PoNumber == poNumber && f.PropertyId == propertyKey)
            .OrderBy(f => f.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        foreach (var failure in failures)
        {
            AddEvent(
                events,
                poNumber,
                propertyId,
                $"failure:{failure.Id}:created",
                "تسجيل تعذر",
                $"{failure.Title} — {FailureStatusLabel(failure.Status)}",
                "warn",
                failure.CreatedAtUtc,
                recordedAt);

            if (failure.Status == PropertyFailureStatus.Suspended)
            {
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"failure:{failure.Id}:suspended",
                    "تعليق المعاملة",
                    string.IsNullOrWhiteSpace(failure.FinalNote)
                        ? failure.Specialist
                        : failure.FinalNote.Trim(),
                    "warn",
                    failure.UpdatedAtUtc,
                    recordedAt);
            }
        }

        return events;
    }

    private static void AddEvent(
        List<PropertyTimelineEntry> list,
        string poNumber,
        Guid propertyId,
        string eventKey,
        string title,
        string? detail,
        string tone,
        DateTime occurredAtUtc,
        DateTime recordedAtUtc)
    {
        list.Add(new PropertyTimelineEntry
        {
            Id = Guid.NewGuid(),
            PoNumber = poNumber,
            PropertyId = propertyId,
            EventKey = eventKey,
            Title = title,
            Detail = string.IsNullOrWhiteSpace(detail) ? null : detail.Trim(),
            Tone = NormalizeTone(tone),
            OccurredAtUtc = occurredAtUtc,
            RecordedAtUtc = recordedAtUtc,
        });
    }

    private static PropertyTimelineEventDto ToDto(PropertyTimelineEntry entry) => new()
    {
        Id = entry.EventKey,
        At = entry.OccurredAtUtc.ToString("O"),
        Title = entry.Title,
        Detail = entry.Detail,
        Tone = entry.Tone,
    };

    private static DateTime DateOnlyToUtc(DateOnly date) =>
        date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

    private static string NormalizeTone(string tone) =>
        tone.Trim().ToLowerInvariant() switch
        {
            "active" => "active",
            "warn" => "warn",
            "muted" => "muted",
            _ => "done",
        };

    private static string TaskPhaseLabel(WorkflowTaskPhase phase) => phase switch
    {
        WorkflowTaskPhase.Enfath => "البيانات الأولية للعقار",
        WorkflowTaskPhase.Bourse => "المرحلة 2 — بيانات البورصة",
        WorkflowTaskPhase.Distribution => "المرحلة 3 — توزيع الأطراف",
        WorkflowTaskPhase.CaseStudy => "دراسة حالة العقار",
        WorkflowTaskPhase.Obstruction => "تعذر — بانتظار المشرف",
        _ => "مكتملة",
    };

    private static string PartyAssignedTitle(WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "تعيين المعاين الميداني",
        WorkflowTaskKind.EngineeringSurvey => "تعيين المكتب الهندسي",
        WorkflowTaskKind.PropertyAppraisal => "تعيين المقيّم العقاري",
        WorkflowTaskKind.GovernmentReview => "تعيين المراجع الحكومي",
        WorkflowTaskKind.ValuationCoordination => "تعيين منسق التقييم",
        _ => "تعيين طرف",
    };

    private static string PartySubmittedTitle(string kind) => kind switch
    {
        "field-inspection" => "إتمام المعاينة الميدانية",
        "engineering-survey" => "إتمام الرفع المساحي",
        "property-appraisal" => "إتمام التقييم العقاري",
        "government-review" => "إتمام المراجعة الحكومية",
        "valuation-coordination" => "إتمام تنسيق التقييم",
        _ => "إتمام عمل الطرف",
    };

    private static string FailureStatusLabel(string status) => status switch
    {
        PropertyFailureStatus.Internal => "داخلي",
        PropertyFailureStatus.Review => "قيد المراجعة",
        PropertyFailureStatus.Approved => "معتمد",
        PropertyFailureStatus.Returned => "مُعاد",
        PropertyFailureStatus.Resolved => "محلول",
        PropertyFailureStatus.Suspended => "معلق",
        _ => status,
    };
}
