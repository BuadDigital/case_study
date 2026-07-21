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

    private static readonly (string RoleId, string RoleLabel, int MaxLoad, int SortOrder)[] TeamLoadRoles =
    [
        ("case-specialist", "دراسة حالة العقارات", SpecialistCapacity, 0),
        ("government-reviewer", "مراجع حكومي", 15, 1),
        ("valuation-coordinator", "منسق التقييم", 15, 2),
        ("field-inspector", "معاين ميداني", 12, 3),
        ("engineering-office", "مكتب هندسي", 10, 4),
    ];

    private static readonly Dictionary<string, (string RoleLabel, int MaxLoad, int SortOrder)> TeamLoadRoleMap =
        TeamLoadRoles.ToDictionary(x => x.RoleId, x => (x.RoleLabel, x.MaxLoad, x.SortOrder));

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

    private async Task<ReportingDashboardDto> BuildDashboardAsync(CancellationToken ct)
    {
        var allTasks = await _upstream.GetWorkflowTasksAsync(ct);

        var valuationRows = BuildRecentValuationRequests(allTasks);

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

        var specialistLoad = BuildTeamLoad(allTasks);

        var governmentReviews = allTasks
            .Where(t => t.Kind == "government-review")
            .OrderBy(t => WorkflowTaskStatus.IsTerminal(t.Status))
            .ThenByDescending(t => t.UpdatedAt)
            .Take(6)
            .Select(t => new ReportingGovernmentReviewRowDto
            {
                TaskId = t.Id,
                PoNumber = t.PoNumber,
                Title = t.Title,
                ReviewerName = t.AssigneeName,
                Status = WorkflowTaskStatus.IsTerminal(t.Status) ? "done" : "progress",
            })
            .ToList();

        var failures = (await _upstream.GetFailuresAsync(ct))
            .Where(f => f.Status is not "resolved" and not "suspended")
            .OrderByDescending(f => f.UpdatedAt)
            .Take(6)
            .Select(f => new ReportingFailureRowDto
            {
                Id = f.Id,
                PoNumber = f.PoNumber,
                DeedNumber = f.DeedNumber,
                Title = f.Title,
                Status = f.Status,
                Severity = f.Severity,
                UpdatedAt = f.UpdatedAt,
            })
            .ToList();

        var feesSummary = await _upstream.GetInspectorFeesSummaryAsync(ct);
        var feeRows = feesSummary.Rows
            .Where(r => r.BillingStatus is not "disbursed")
            .OrderByDescending(r => r.UpdatedAtUtc ?? DateTime.MinValue)
            .Take(6)
            .Select(r => new ReportingPartyFeeRowDto
            {
                PoNumber = r.PoNumber,
                PropertyLabel = r.PropertyLabel,
                PartyKindLabel = PartyKindLabel(r.TaskKind),
                BillingStatus = r.BillingStatus,
                BillingStatusLabel = r.BillingStatusLabel,
                NetFeeSar = r.NetFeeSar,
            })
            .ToList();

        var partyFeesOverview = new ReportingPartyFeesOverviewDto
        {
            PendingSupervisorReview = feesSummary.Rows.Count(r => r.BillingStatus == "sup-review"),
            AtFinance = feesSummary.Rows.Count(r => r.BillingStatus == "at-finance"),
            DisbursementRequested = feesSummary.Rows.Count(r => r.BillingStatus == "disb-req"),
            NetDraftSar = feesSummary.NetDraftSar,
            SupReviewSar = feesSummary.SupReviewSar,
            AtFinanceSar = feesSummary.AtFinanceSar,
            DisbReqSar = feesSummary.DisbReqSar,
            RecentRows = feeRows,
        };

        return new ReportingDashboardDto
        {
            RecentValuationRequests = valuationRows,
            RecentGovernmentReviews = governmentReviews,
            RecentFailures = failures,
            PartyFeesOverview = partyFeesOverview,
            TeamFieldMembers = teamField,
            SpecialistLoad = specialistLoad,
            FieldInspectionProgress = await _upstream.GetFieldInspectionSummaryAsync(ct),
        };
    }

    private static List<ValuationRequestDto> BuildRecentValuationRequests(
        IReadOnlyList<WorkflowTaskDto> allTasks)
    {
        var appraisalRows = allTasks
            .Where(t => t.Kind == "property-appraisal")
            .Where(t => !WorkflowTaskStatus.IsTerminal(t.Status))
            .OrderByDescending(t => t.UpdatedAt)
            .Take(6)
            .Select(MapAppraisalTaskToValuationRequest)
            .ToList();

        if (appraisalRows.Count > 0) return appraisalRows;

        return allTasks
            .Where(t => t.Kind == "valuation-coordination")
            .Where(t => !WorkflowTaskStatus.IsTerminal(t.Status))
            .OrderByDescending(t => t.UpdatedAt)
            .Take(6)
            .Select(MapAppraisalTaskToValuationRequest)
            .ToList();
    }

    private static ValuationRequestDto MapAppraisalTaskToValuationRequest(WorkflowTaskDto task)
    {
        _ = Guid.TryParse(task.Id, out var taskId);
        var propertyLabel = string.IsNullOrWhiteSpace(task.Title)
            ? task.PropertyId ?? "—"
            : task.Title.Trim();

        return new ValuationRequestDto
        {
            Id = taskId,
            DisplayId = $"{task.PoNumber}-{task.PropertyOrdinal}",
            PropId = propertyLabel,
            Area = "",
            Type = "",
            Appraiser = task.AssigneeName,
            Status = WorkflowTaskStatus.IsTerminal(task.Status) ? "done" : "progress",
            Date = task.UpdatedAt,
        };
    }

    private static List<ReportingSpecialistLoadDto> BuildTeamLoad(
        IReadOnlyList<WorkflowTaskDto> allTasks)
    {
        return allTasks
            .Where(t => IsActiveQueueStatus(t.Status))
            .Where(t => TeamLoadRoleMap.ContainsKey(t.AssigneeRole) && MatchesTeamLoadTask(t, t.AssigneeRole))
            .GroupBy(t => (t.AssigneeRole, t.AssigneeName))
            .Select(g =>
            {
                var cfg = TeamLoadRoleMap[g.Key.AssigneeRole];
                var count = g.Count();
                return new ReportingSpecialistLoadDto
                {
                    RoleId = g.Key.AssigneeRole,
                    Name = g.Key.AssigneeName,
                    RoleLabel = cfg.RoleLabel,
                    CurrentLoad = count,
                    MaxLoad = cfg.MaxLoad,
                    Tone = count >= cfg.MaxLoad * 0.6 ? "warning" : "success",
                };
            })
            .Where(row => !IsTeamLoadPlaceholderRow(row.Name, row.RoleLabel))
            .OrderBy(x => TeamLoadRoleMap[x.RoleId].SortOrder)
            .ThenByDescending(x => x.CurrentLoad)
            .ThenBy(x => x.Name, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>
    /// Drop placeholder assignee rows where the name is just the role title (e.g. «معاين ميداني»)
    /// or the legacy default demo persona superseded by named staff in HR seed.
    /// </summary>
    private static bool IsTeamLoadPlaceholderRow(string name, string roleLabel)
    {
        var trimmed = name.Trim();
        if (string.IsNullOrEmpty(trimmed))
            return true;

        if (string.Equals(trimmed, roleLabel.Trim(), StringComparison.Ordinal))
            return true;

        foreach (var (_, label, _, _) in TeamLoadRoles)
        {
            if (string.Equals(trimmed, label, StringComparison.Ordinal))
                return true;
        }

        return string.Equals(trimmed, "أحمد سعيد", StringComparison.Ordinal);
    }

    /// <summary>
    /// Same open-work rules as sidebar badges and active-transaction queues (excludes completed/cancelled).
    /// </summary>
    private static bool IsActiveQueueStatus(string? status) =>
        status is WorkflowTaskStatus.Open or WorkflowTaskStatus.Blocked;

    /// <summary>
    /// Count only tasks that belong on each role's active queue — not every open task for that assignee role.
    /// </summary>
    private static bool MatchesTeamLoadTask(WorkflowTaskDto task, string roleId) =>
        task.AssigneeRole == roleId && roleId switch
        {
            "case-specialist" =>
                task.Kind == "case-study-property" && task.Phase == "case-study",
            "government-reviewer" => task.Kind == "government-review",
            "valuation-coordinator" => task.Kind == "valuation-coordination",
            "field-inspector" => task.Kind == "field-inspection",
            "engineering-office" => task.Kind == "engineering-survey",
            _ => false,
        };

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

    private static string PartyKindLabel(string taskKind) =>
        taskKind switch
        {
            "field-inspection" => "معاينة ميدانية",
            "engineering-survey" => "رفع مساحي",
            _ => taskKind,
        };
}
