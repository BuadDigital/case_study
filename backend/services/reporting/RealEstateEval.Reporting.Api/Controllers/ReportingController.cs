using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Reporting.Api.Services;

namespace RealEstateEval.Reporting.Api.Controllers;

[ApiController]
[Route("api/reporting/v1")]
[Authorize]
public class ReportingController : ControllerBase
{
    private const int SpecialistCapacity = 20;
    private readonly IReportingUpstreamClient _upstream;
    private readonly ApiResponseCache _cache;

    public ReportingController(IReportingUpstreamClient upstream, ApiResponseCache cache)
    {
        _upstream = upstream;
        _cache = cache;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<ReportingDashboardDto>> Dashboard(CancellationToken ct)
    {
        var dto = await _cache.GetOrCreateAsync(
            CacheKeys.ReportingDashboard,
            CacheDurations.Reporting,
            _ => BuildDashboardAsync(ct),
            ct);
        return Ok(dto);
    }

    [HttpGet("kpi")]
    public async Task<ActionResult<ReportingKpiDto>> Kpi(CancellationToken ct)
    {
        var dto = await _cache.GetOrCreateAsync(
            CacheKeys.ReportingKpi,
            CacheDurations.Reporting,
            _ => BuildKpiAsync(ct),
            ct);
        return Ok(dto);
    }

    private async Task<ReportingDashboardDto> BuildDashboardAsync(CancellationToken ct)
    {
        var valuationRows = (await _upstream.GetValuationRequestsAsync(ct))
            .OrderByDescending(x => x.Date)
            .Take(6)
            .ToList();

        var allTasks = await _upstream.GetWorkflowTasksAsync(ct);

        var openPartyTasks = allTasks
            .Where(t => !WorkflowTaskStatus.IsTerminal(t.Status))
            .Where(t =>
                t.Kind == "property-inspection"
                || t.Kind == "property-appraisal"
                || t.Kind == "engineering-survey")
            .ToList();

        var teamField = openPartyTasks
            .GroupBy(t => t.AssigneeName)
            .Select(g =>
            {
                var sample = g.First();
                var kind = sample.Kind switch
                {
                    "property-inspection" => "internal",
                    "property-appraisal" => "internal",
                    _ => "freelance",
                };
                return new ReportingTeamMemberDto
                {
                    Initials = Initials(g.Key),
                    Name = g.Key,
                    RoleLine = RoleLine(sample.Kind, sample.Title),
                    TeamKind = kind,
                    ActiveCount = g.Count(),
                };
            })
            .OrderByDescending(x => x.ActiveCount)
            .Take(6)
            .ToList();

        var specialistLoad = allTasks
            .Where(t => t.AssigneeRole == "case-specialist")
            .Where(t => !WorkflowTaskStatus.IsTerminal(t.Status))
            .GroupBy(t => t.AssigneeName)
            .Select(g => new ReportingSpecialistLoadDto
            {
                Name = g.Key,
                RoleLabel = "أخصائي",
                CurrentLoad = g.Count(),
                MaxLoad = SpecialistCapacity,
                Tone = g.Count() >= SpecialistCapacity * 0.6 ? "warning" : "success",
            })
            .ToList();

        return new ReportingDashboardDto
        {
            RecentValuationRequests = valuationRows,
            TeamFieldMembers = teamField,
            SpecialistLoad = specialistLoad,
            FieldInspectionProgress = await _upstream.GetFieldInspectionSummaryAsync(ct),
        };
    }

    private async Task<ReportingKpiDto> BuildKpiAsync(CancellationToken ct)
    {
        var tasks = await _upstream.GetWorkflowTasksAsync(ct);
        var failures = await _upstream.GetFailureCountAsync(ct);
        var properties = await _upstream.GetPropertyCountAsync(ct);

        var completed = tasks.Count(t => t.Status == WorkflowTaskStatus.Completed);
        var total = tasks.Count;
        var onTime = total > 0 ? (int)Math.Round(completed * 100.0 / total) : 0;

        var today = DateTime.UtcNow.Date;
        var completedToday = tasks.Count(t =>
            t.Status == WorkflowTaskStatus.Completed
            && DateTime.TryParse(t.UpdatedAt, out var updated)
            && updated.Date == today);

        var failureRate = properties > 0
            ? Math.Round(failures * 100.0 / properties, 1)
            : 0;

        var specialistScores = tasks
            .Where(t => t.AssigneeRole == "case-specialist")
            .GroupBy(t => t.AssigneeName)
            .Select(g =>
            {
                var done = g.Count(t => t.Status == WorkflowTaskStatus.Completed);
                var score = g.Any()
                    ? (int)Math.Round(done * 100.0 / g.Count())
                    : 0;
                return new ReportingKpiScoreDto { Name = g.Key, ScorePercent = score };
            })
            .OrderByDescending(x => x.ScorePercent)
            .Take(6)
            .ToList();

        var providerScores = tasks
            .Where(t =>
                t.Kind == "property-inspection"
                || t.Kind == "property-appraisal"
                || t.Kind == "engineering-survey")
            .GroupBy(t => t.AssigneeName)
            .Select(g =>
            {
                var done = g.Count(t => t.Status == WorkflowTaskStatus.Completed);
                var score = g.Any()
                    ? (int)Math.Round(done * 100.0 / g.Count())
                    : 0;
                return new ReportingKpiScoreDto { Name = g.Key, ScorePercent = score };
            })
            .OrderByDescending(x => x.ScorePercent)
            .Take(6)
            .ToList();

        return new ReportingKpiDto
        {
            OnTimeCompletionRate = onTime,
            AvgPropertyDaysLabel = "3.6 يوم",
            FailureRatePercent = failureRate,
            CompletedToday = completedToday,
            SpecialistScores = specialistScores,
            ProviderScores = providerScores,
        };
    }

    private static string Initials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "—";
        if (parts.Length == 1) return parts[0][..Math.Min(2, parts[0].Length)];
        return $"{parts[0][0]}{parts[^1][0]}";
    }

    private static string RoleLine(string kind, string title) =>
        kind switch
        {
            "property-inspection" => "معاين — ميداني",
            "property-appraisal" => "مقيم — ميداني",
            "engineering-survey" => "مكتب هندسي — رفع مساحي",
            _ => title,
        };
}
