using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// Operational dashboard metrics from live workflow tasks — not prototype numbers.
/// Dwell is the average time tasks currently sit in a stage (open/blocked) plus
/// completed duration for party stages that have their own task rows.
/// </summary>
public static class DashboardOpsMetricsRules
{
    public const decimal EnfathSlaDays = 1m;
    public const decimal BourseSlaDays = 1m;
    public const decimal DistributionSlaDays = 1m;
    public const decimal CaseStudySlaDays = 2m;
    public const decimal GovernmentReviewSlaDays = 1.5m;
    public const decimal AppraisalSlaDays = 1.5m;

    public const string StageEnfath = WorkflowTaskPhaseValues.Enfath;
    public const string StageBourse = WorkflowTaskPhaseValues.Bourse;
    public const string StageDistribution = WorkflowTaskPhaseValues.Distribution;
    public const string StageCaseStudy = WorkflowTaskPhaseValues.CaseStudy;
    public const string StageGovernmentReview = WorkflowTaskKindValues.GovernmentReview;
    public const string StageAppraisal = "appraisal";

    public sealed record TaskSnap(
        string Kind,
        string Phase,
        string Status,
        DateTime CreatedAtUtc,
        DateTime UpdatedAtUtc,
        string? ObstructionPriorPhase = null);

    public sealed record StageDwell(
        string Key,
        string LabelAr,
        decimal AvgDays,
        decimal SlaDays,
        int SampleCount,
        bool ExceedsSla);

    public sealed record YearlyCounts(int Year, IReadOnlyList<int> Monthly);

    public static IReadOnlyList<StageDwell> EmptyStages() =>
    [
        Stage(StageEnfath, "البيانات الأولية", EnfathSlaDays, 0, 0),
        Stage(StageBourse, "البورصة", BourseSlaDays, 0, 0),
        Stage(StageDistribution, "التوزيع", DistributionSlaDays, 0, 0),
        Stage(StageCaseStudy, "دراسة الحالة", CaseStudySlaDays, 0, 0),
        Stage(StageGovernmentReview, "المراجعة الحكومية", GovernmentReviewSlaDays, 0, 0),
        Stage(StageAppraisal, "التقييم والرفع", AppraisalSlaDays, 0, 0),
    ];

    public static IReadOnlyList<StageDwell> BuildStageDwell(
        IEnumerable<TaskSnap> tasks,
        DateTime utcNow)
    {
        var buckets = new Dictionary<string, List<decimal>>(StringComparer.Ordinal)
        {
            [StageEnfath] = [],
            [StageBourse] = [],
            [StageDistribution] = [],
            [StageCaseStudy] = [],
            [StageGovernmentReview] = [],
            [StageAppraisal] = [],
        };

        foreach (var task in tasks)
        {
            if (string.Equals(task.Status, WorkflowTaskStatusValues.Cancelled, StringComparison.OrdinalIgnoreCase))
                continue;

            var active = IsActive(task.Status);
            var completed = string.Equals(
                task.Status,
                WorkflowTaskStatusValues.Completed,
                StringComparison.OrdinalIgnoreCase);

            if (string.Equals(task.Kind, WorkflowTaskKindValues.CaseStudyProperty, StringComparison.Ordinal))
            {
                if (!active) continue;
                var phase = string.Equals(task.Phase, WorkflowTaskPhaseValues.Obstruction, StringComparison.Ordinal)
                    ? (task.ObstructionPriorPhase ?? "")
                    : task.Phase;
                var key = ParentPhaseKey(phase);
                if (key is null) continue;
                buckets[key].Add(DaysBetween(task.UpdatedAtUtc, utcNow));
                continue;
            }

            if (string.Equals(task.Kind, WorkflowTaskKindValues.GovernmentReview, StringComparison.Ordinal))
            {
                AddPartyDwell(buckets[StageGovernmentReview], task, utcNow, active, completed);
                continue;
            }

            if (string.Equals(task.Kind, WorkflowTaskKindValues.PropertyAppraisal, StringComparison.Ordinal))
                AddPartyDwell(buckets[StageAppraisal], task, utcNow, active, completed);
        }

        return
        [
            FromBucket(StageEnfath, "البيانات الأولية", EnfathSlaDays, buckets),
            FromBucket(StageBourse, "البورصة", BourseSlaDays, buckets),
            FromBucket(StageDistribution, "التوزيع", DistributionSlaDays, buckets),
            FromBucket(StageCaseStudy, "دراسة الحالة", CaseStudySlaDays, buckets),
            FromBucket(StageGovernmentReview, "المراجعة الحكومية", GovernmentReviewSlaDays, buckets),
            FromBucket(StageAppraisal, "التقييم والرفع", AppraisalSlaDays, buckets),
        ];
    }

    public static IReadOnlyList<YearlyCounts> BuildCompletionTrend(
        IEnumerable<DateTime> completionUtc,
        int currentYear,
        int yearSpan = 3)
    {
        var startYear = currentYear - Math.Max(0, yearSpan - 1);
        var map = new Dictionary<int, int[]>();
        for (var y = startYear; y <= currentYear; y++)
            map[y] = new int[12];

        foreach (var at in completionUtc)
        {
            if (at.Year < startYear || at.Year > currentYear) continue;
            map[at.Year][at.Month - 1]++;
        }

        return map
            .OrderBy(kv => kv.Key)
            .Select(kv => new YearlyCounts(kv.Key, kv.Value))
            .ToList();
    }

    public static bool IsPropertyCompletion(TaskSnap task) =>
        string.Equals(task.Kind, WorkflowTaskKindValues.CaseStudyProperty, StringComparison.Ordinal)
        && string.Equals(task.Status, WorkflowTaskStatusValues.Completed, StringComparison.OrdinalIgnoreCase);

    public static int[] QuarterlyFromMonthly(IReadOnlyList<int> monthly)
    {
        var q = new int[4];
        for (var i = 0; i < monthly.Count && i < 12; i++)
            q[i / 3] += monthly[i];
        return q;
    }

    private static void AddPartyDwell(
        List<decimal> bucket,
        TaskSnap task,
        DateTime utcNow,
        bool active,
        bool completed)
    {
        if (active)
        {
            bucket.Add(DaysBetween(task.CreatedAtUtc, utcNow));
            return;
        }

        if (completed)
        {
            var days = DaysBetween(task.CreatedAtUtc, task.UpdatedAtUtc);
            if (days >= 0) bucket.Add(days);
        }
    }

    private static string? ParentPhaseKey(string phase) =>
        phase switch
        {
            WorkflowTaskPhaseValues.Enfath => StageEnfath,
            WorkflowTaskPhaseValues.Bourse => StageBourse,
            WorkflowTaskPhaseValues.Distribution => StageDistribution,
            WorkflowTaskPhaseValues.CaseStudy => StageCaseStudy,
            _ => null,
        };

    private static bool IsActive(string status) =>
        string.Equals(status, WorkflowTaskStatusValues.Open, StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, WorkflowTaskStatusValues.Blocked, StringComparison.OrdinalIgnoreCase);

    private static decimal DaysBetween(DateTime fromUtc, DateTime toUtc)
    {
        var span = toUtc - fromUtc;
        if (span.TotalDays < 0) return 0m;
        return (decimal)span.TotalDays;
    }

    private static StageDwell FromBucket(
        string key,
        string labelAr,
        decimal sla,
        IReadOnlyDictionary<string, List<decimal>> buckets)
    {
        var samples = buckets[key];
        return Stage(key, labelAr, sla, AverageDays(samples), samples.Count);
    }

    private static decimal AverageDays(List<decimal> samples)
    {
        if (samples.Count == 0) return 0m;
        var avg = samples.Average();
        return Math.Round(avg, 1, MidpointRounding.AwayFromZero);
    }

    private static StageDwell Stage(
        string key,
        string labelAr,
        decimal sla,
        decimal avg,
        int count) =>
        new(key, labelAr, avg, sla, count, count > 0 && avg > sla);
}
