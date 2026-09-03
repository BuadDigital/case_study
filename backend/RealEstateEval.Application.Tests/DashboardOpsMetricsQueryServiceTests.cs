using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;

namespace RealEstateEval.Application.Tests;

public class DashboardOpsMetricsQueryServiceTests
{
    [Fact]
    public async Task GetAsync_uses_live_tasks_not_a_paged_slice()
    {
        var now = DateTime.UtcNow;
        await using var db = CreateDb();
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-1",
            now.AddDays(-3),
            phase: WorkflowTaskPhase.Bourse,
            status: WorkflowTaskStatus.Open,
            updatedAtUtc: now.AddHours(-36)));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-2",
            now.AddDays(-40),
            phase: WorkflowTaskPhase.Done,
            status: WorkflowTaskStatus.Completed,
            updatedAtUtc: now.AddDays(-2)));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-3",
            now.AddDays(-10),
            phase: WorkflowTaskPhase.Enfath,
            status: WorkflowTaskStatus.Cancelled,
            updatedAtUtc: now.AddDays(-1)));
        await db.SaveChangesAsync();

        var dto = await new DashboardOpsMetricsQueryService(TestInspectorFeeServiceFactory.ShareCaseStudy(db)).GetAsync();

        var bourse = dto.StageDwell.Single(s => s.Key == DashboardOpsMetricsRules.StageBourse);
        Assert.Equal(1, bourse.SampleCount);
        Assert.True(bourse.AvgDays >= 1.4m);
        Assert.True(bourse.ExceedsSla);
        Assert.Equal(0, dto.StageDwell.Single(s => s.Key == DashboardOpsMetricsRules.StageEnfath).SampleCount);

        var thisYear = dto.CompletionTrend.Single(y => y.Year == now.Year);
        Assert.Equal(1, thisYear.Monthly.Sum());
    }

    private static CaseStudyDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"dashboard-ops-{Guid.NewGuid():N}")
            .Options;
        return new CaseStudyDbContext(options);
    }
}
