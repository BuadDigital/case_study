using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// First read of a property that has no stored rows (it predates the timeline): the milestones are rebuilt once
/// from the tasks, submissions, report and failures, in the same vocabulary the live recorders use.
/// </summary>
public sealed partial class PropertyTimelineService
{
    private async Task<List<PropertyTimelineEntry>> BootstrapAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var events = new List<PropertyTimelineEntry>();
        var recordedAt = _time.UtcNow();

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
            "استلام أمر العمل من إنفاذ",
            string.IsNullOrWhiteSpace(order.AssignmentSpecialist)
                ? null
                : $"أخصائي الإسناد: {order.AssignmentSpecialist.Trim()}",
            PropertyTimelineTones.Done,
            DateOnlyToUtc(order.ReceivedFromEnfathAt),
            recordedAt);

        var tasks = await _caseStudy.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.PoNumber == poNumber && t.PropertyId == propertyId)
            .OrderBy(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var parent = tasks.FirstOrDefault(t => t.Kind == WorkflowTaskKind.CaseStudyProperty);
        if (parent is not null)
        {
            if (property.BourseDataCompleted)
            {
                var bourseAt = property.BourseCompletedAtUtc ?? parent.CreatedAtUtc;
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"property-bourse:{bourseAt.Ticks}",
                    "إتمام استعلام البورصة",
                    WorkOrderPropertyWriteRules.BourseTimelineDetail(
                        property.City, property.District, property.BourseCompletedByName),
                    PropertyTimelineTones.Done,
                    bourseAt,
                    recordedAt);
            }

            var children = tasks
                .Where(t => t.ParentTaskId == parent.Id)
                .ToList();
            if (children.Count > 0)
            {
                var distributionAt = children.Min(c => c.CreatedAtUtc);
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"task:{parent.Id}:distribution:{distributionAt.Ticks}",
                    "توزيع المعاملة",
                    WorkflowTaskDistributionRules.DistributionDetail(parent, children, caseSpecialistAssigned: true),
                    PropertyTimelineTones.Done,
                    distributionAt,
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
                        $"party:{submission.WorkflowTaskId}:submitted:{submission.SubmittedAtUtc.Value.Ticks}",
                        WorkflowTaskKindLabels.SubmittedTitleAr(submission.Kind),
                        child?.AssigneeName,
                        PropertyTimelineTones.Done,
                        submission.SubmittedAtUtc.Value,
                        recordedAt);
                }
            }

            var caseStudyReport = await _caseStudy.CaseStudyReports
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.TaskId == parent.Id && !f.IsPartyContribution, cancellationToken);
            if (caseStudyReport is not null &&
                caseStudyReport.Status is CaseStudyReportStatuses.Issued)
            {
                var reportAt = caseStudyReport.SavedAtUtc ?? caseStudyReport.UpdatedAtUtc;
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"case-study-report:{parent.Id}:issued:{reportAt.Ticks}",
                    "إصدار تقرير دراسة الحالة",
                    null,
                    PropertyTimelineTones.Done,
                    reportAt,
                    recordedAt);
            }
        }

        var propertyKey = propertyId.ToString();
        var failures = await _failureLookup.ListForPropertyAsync(poNumber, propertyKey, cancellationToken);

        foreach (var failure in failures)
        {
            var createdAt = IsoTimestamps.ParseUtc(failure.CreatedAt) ?? recordedAt;
            var updatedAt = IsoTimestamps.ParseUtc(failure.UpdatedAt) ?? createdAt;
            var failureId = Guid.TryParse(failure.Id, out var parsedId) ? parsedId : Guid.Empty;
            AddEvent(
                events,
                poNumber,
                propertyId,
                $"failure:{failureId}:created",
                "تسجيل تعذّر",
                $"{failure.Title} — {PropertyFailureStatus.LabelAr(failure.Status)}",
                PropertyTimelineTones.Warn,
                createdAt,
                recordedAt);

            if (failure.Status == PropertyFailureStatus.Suspended)
            {
                AddEvent(
                    events,
                    poNumber,
                    propertyId,
                    $"failure:{failureId}:suspended",
                    "تعليق المعاملة",
                    string.IsNullOrWhiteSpace(failure.FinalNote)
                        ? failure.Specialist
                        : failure.FinalNote.Trim(),
                    PropertyTimelineTones.Warn,
                    updatedAt,
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

    private static DateTime DateOnlyToUtc(DateOnly date) =>
        date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
}
