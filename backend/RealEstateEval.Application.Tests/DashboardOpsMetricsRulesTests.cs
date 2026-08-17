using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class DashboardOpsMetricsRulesTests
{
    private static readonly DateTime Now = new(2026, 8, 17, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Open_parent_in_bourse_counts_current_dwell()
    {
        var dwell = DashboardOpsMetricsRules.BuildStageDwell(
            [
                new(
                    WorkflowTaskKindValues.CaseStudyProperty,
                    WorkflowTaskPhaseValues.Bourse,
                    WorkflowTaskStatusValues.Open,
                    Now.AddDays(-3),
                    Now.AddHours(-36)),
            ],
            Now);

        var bourse = dwell.Single(s => s.Key == DashboardOpsMetricsRules.StageBourse);
        Assert.Equal(1.5m, bourse.AvgDays);
        Assert.Equal(1, bourse.SampleCount);
        Assert.True(bourse.ExceedsSla);
        Assert.Equal(0, dwell.Single(s => s.Key == DashboardOpsMetricsRules.StageEnfath).SampleCount);
    }

    [Fact]
    public void Completed_appraisal_uses_created_to_updated_span()
    {
        var dwell = DashboardOpsMetricsRules.BuildStageDwell(
            [
                new(
                    WorkflowTaskKindValues.PropertyAppraisal,
                    WorkflowTaskPhaseValues.Done,
                    WorkflowTaskStatusValues.Completed,
                    Now.AddDays(-4),
                    Now.AddDays(-3)),
            ],
            Now);

        var row = dwell.Single(s => s.Key == DashboardOpsMetricsRules.StageAppraisal);
        Assert.Equal(1.0m, row.AvgDays);
        Assert.False(row.ExceedsSla);
    }

    [Fact]
    public void Cancelled_tasks_are_ignored()
    {
        var dwell = DashboardOpsMetricsRules.BuildStageDwell(
            [
                new(
                    WorkflowTaskKindValues.CaseStudyProperty,
                    WorkflowTaskPhaseValues.Enfath,
                    WorkflowTaskStatusValues.Cancelled,
                    Now.AddDays(-10),
                    Now.AddDays(-1)),
            ],
            Now);

        Assert.All(dwell, s => Assert.Equal(0, s.SampleCount));
    }

    [Fact]
    public void Completion_trend_buckets_by_month()
    {
        var years = DashboardOpsMetricsRules.BuildCompletionTrend(
            [
                new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 1, 20, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2025, 12, 2, 0, 0, 0, DateTimeKind.Utc),
            ],
            currentYear: 2026,
            yearSpan: 3);

        Assert.Equal([2024, 2025, 2026], years.Select(y => y.Year));
        Assert.Equal(2, years.Single(y => y.Year == 2026).Monthly[0]);
        Assert.Equal(1, years.Single(y => y.Year == 2025).Monthly[11]);
        Assert.Equal([1], DashboardOpsMetricsRules.QuarterlyFromMonthly(
            years.Single(y => y.Year == 2025).Monthly).Skip(3).Take(1));
    }
}
