using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A recall moves a report between two desks, so each step tells the other side. The publisher
/// only stages the outbox row: a notice staged after the step's save is never written.
/// </summary>
public sealed class EvaluatorRecallNoticeTests
{
    private static readonly Guid TaskId = Guid.Parse("b2000001-0000-4000-8000-000000000001");
    private static readonly Guid PropertyId = Guid.Parse("b2000001-0000-4000-8000-000000000002");

    [Fact]
    public async Task Asking_for_a_recall_commits_the_specialist_notice()
    {
        await using var db = TestDatabases.Valuation("recall-notice-request");
        var service = CreateService(db);

        var (result, error) = await service.RequestAsync(NewRequest("خطأ في المساحة"));

        Assert.Null(error);
        Assert.NotNull(result);
        var notice = await SingleNoticeAsync(db);
        Assert.Contains("طلب استرجاع تقرير التقييم", notice);
        Assert.Contains("خطأ في المساحة", notice);
        Assert.Contains(ValuationNoticeAudiences.CaseSpecialist, notice);
    }

    [Fact]
    public async Task Approving_the_recall_commits_the_appraiser_notice()
    {
        await using var db = TestDatabases.Valuation("recall-notice-approve");
        var service = CreateService(db);
        await service.RequestAsync(NewRequest("خطأ في المساحة"));
        await ClearOutboxAsync(db);

        var result = await service.ApproveAsync(TaskId.ToString("D"));

        Assert.NotNull(result);
        var notice = await SingleNoticeAsync(db);
        Assert.Contains("قُبل استرجاع التقرير", notice);
        Assert.Contains(ValuationNoticeAudiences.Appraiser, notice);
    }

    [Fact]
    public async Task Rejecting_the_recall_commits_the_appraiser_notice()
    {
        await using var db = TestDatabases.Valuation("recall-notice-reject");
        var service = CreateService(db);
        await service.RequestAsync(NewRequest("خطأ في المساحة"));
        await ClearOutboxAsync(db);

        var result = await service.RejectAsync(
            TaskId.ToString("D"),
            new RejectEvaluatorRecallRequest { SpecialistNote = "التقرير سليم" });

        Assert.NotNull(result);
        var notice = await SingleNoticeAsync(db);
        Assert.Contains("رُفض استرجاع التقرير", notice);
        Assert.Contains("التقرير سليم", notice);
    }

    private static EvaluatorRecallsService CreateService(ValuationDbContext db) =>
        new(db, events: new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance));

    private static CreateEvaluatorRecallRequest NewRequest(string reason) => new()
    {
        TaskId = TaskId.ToString("D"),
        PropertyId = PropertyId.ToString("D"),
        PoNumber = "PO-RECALL",
        Reason = reason,
    };

    /// <summary>Read back from the store, not the tracker — only a committed row counts.</summary>
    private static async Task<string> SingleNoticeAsync(ValuationDbContext db)
    {
        db.ChangeTracker.Clear();
        var row = await db.OutboxMessages.AsNoTracking()
            .SingleAsync(x => x.EventType == IntegrationEventTypes.ValuationWorkflowNotice);
        using var doc = System.Text.Json.JsonDocument.Parse(row.PayloadJson);
        var payload = doc.RootElement.GetProperty("Payload");
        return string.Join(
            " | ",
            payload.GetProperty("Audience").GetString(),
            payload.GetProperty("Title").GetString(),
            payload.GetProperty("Body").GetString());
    }

    private static async Task ClearOutboxAsync(ValuationDbContext db)
    {
        db.OutboxMessages.RemoveRange(await db.OutboxMessages.ToListAsync());
        await db.SaveChangesAsync();
    }
}
