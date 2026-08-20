using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Org-wide dwell and completion-trend snaps — unpaged, not visibility-filtered.
/// Management-report callers only.
/// </summary>
public sealed class DashboardOpsMetricsQueryService : IDashboardOpsMetricsQuery
{
    private readonly ICaseStudyRepository _db;
    private readonly TimeProvider _time;

    public DashboardOpsMetricsQueryService(ICaseStudyRepository db,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
    }

    public async Task<DashboardOpsMetricsDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var now = _time.UtcNow();
        var startUtc = new DateTime(now.Year - 2, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var rows = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Status != WorkflowTaskStatus.Cancelled)
            .Where(t =>
                t.Kind == WorkflowTaskKind.CaseStudyProperty
                || t.Kind == WorkflowTaskKind.GovernmentReview
                || t.Kind == WorkflowTaskKind.PropertyAppraisal)
            .Where(t =>
                t.Status != WorkflowTaskStatus.Completed
                || t.Kind != WorkflowTaskKind.CaseStudyProperty
                || t.UpdatedAtUtc >= startUtc)
            .Select(t => new
            {
                t.Kind,
                t.Phase,
                t.Status,
                t.CreatedAtUtc,
                t.UpdatedAtUtc,
                t.ObstructionPriorPhase,
            })
            .ToListAsync(cancellationToken);

        var snaps = rows
            .Select(t => new DashboardOpsMetricsRules.TaskSnap(
                t.Kind.ToDbValue(),
                t.Phase.ToDbValue(),
                t.Status.ToDbValue(),
                t.CreatedAtUtc,
                t.UpdatedAtUtc,
                t.ObstructionPriorPhase.ToDbValue()))
            .ToList();

        var dwell = DashboardOpsMetricsRules.BuildStageDwell(snaps, now);
        var completions = snaps
            .Where(DashboardOpsMetricsRules.IsPropertyCompletion)
            .Select(s => s.UpdatedAtUtc);

        return new DashboardOpsMetricsDto
        {
            StageDwell = dwell
                .Select(s => new ReportingStageDwellDto
                {
                    Key = s.Key,
                    LabelAr = s.LabelAr,
                    AvgDays = s.AvgDays,
                    SlaDays = s.SlaDays,
                    SampleCount = s.SampleCount,
                    ExceedsSla = s.ExceedsSla,
                })
                .ToList(),
            CompletionTrend = DashboardOpsMetricsRules
                .BuildCompletionTrend(completions, now.Year)
                .Select(y => new ReportingCompletionYearDto
                {
                    Year = y.Year,
                    Monthly = y.Monthly,
                })
                .ToList(),
        };
    }
}
