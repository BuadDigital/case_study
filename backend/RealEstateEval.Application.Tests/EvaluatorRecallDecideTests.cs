using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The specialist decision on an appraiser recall: approve REOPENS the appraiser package first
/// (idempotent call to Case Study), and only then records the approval. Two services, two
/// databases, so a failed second step leaves the recall pending and the whole thing can be sent
/// again. A deposited report refuses the recall.
/// </summary>
public sealed class EvaluatorRecallDecideTests
{
    private static readonly Guid TaskId = Guid.Parse("b3000001-0000-4000-8000-000000000001");
    private static readonly Guid PropertyId = Guid.Parse("b3000001-0000-4000-8000-000000000002");

    private static string TaskKey => TaskId.ToString("D");

    private static DecideEvaluatorRecallRequest Approve() =>
        new() { Decision = EvaluatorRecallDecisions.Approve };

    [Fact]
    public async Task Approve_reopens_the_package_first_then_records_the_approval()
    {
        await using var db = TestDatabases.Valuation("recall-decide-order");
        var caseStudy = new EvaluatorRecallNoticeTests.FakeRecallReopen();
        // Seen from inside the reopen call: the recall must still be pending.
        string? statusDuringReopen = null;
        caseStudy.Behaviour = async () =>
        {
            statusDuringReopen = (await db.EvaluatorRecallRecords.AsNoTracking()
                .SingleAsync(x => x.TaskId == TaskId)).Status;
            return (true, null);
        };
        var service = await ArrangeAsync(db, caseStudy);

        var (result, errors) = await service.DecideAsync(TaskKey, Approve());

        Assert.Null(errors);
        Assert.Equal(EvaluatorRecallStatus.Pending, statusDuringReopen);
        Assert.Equal(EvaluatorRecallStatus.Approved, result!.Status);
        var call = Assert.Single(caseStudy.Calls);
        Assert.Equal(TaskId, call.TaskId);
        Assert.Equal("خطأ في المساحة", call.Reason);
        db.ChangeTracker.Clear();
        Assert.Equal(
            EvaluatorRecallStatus.Approved,
            (await db.EvaluatorRecallRecords.SingleAsync()).Status);
        Assert.Contains("قُبل استرجاع التقرير", await NoticesAsync(db));
    }

    [Fact]
    public async Task A_failed_reopen_leaves_the_recall_pending_and_sends_no_notice()
    {
        await using var db = TestDatabases.Valuation("recall-decide-transport");
        var caseStudy = new EvaluatorRecallNoticeTests.FakeRecallReopen
        {
            Behaviour = () => throw new HttpRequestException("case study is down"),
        };
        var service = await ArrangeAsync(db, caseStudy);

        var (result, errors) = await service.DecideAsync(TaskKey, Approve());

        Assert.Null(result);
        Assert.Equal(
            EvaluatorRecallsService.ReopenUnavailableMessageAr,
            errors![EvaluatorRecallDecisions.UpstreamErrorKey]);
        db.ChangeTracker.Clear();
        var row = await db.EvaluatorRecallRecords.SingleAsync();
        Assert.Equal(EvaluatorRecallStatus.Pending, row.Status);
        Assert.Null(row.ResolvedAtUtc);
        Assert.Empty(await db.OutboxMessages
            .Where(x => x.EventType == IntegrationEventTypes.ValuationWorkflowNotice)
            .ToListAsync());
    }

    [Fact]
    public async Task A_refused_reopen_keeps_the_recall_pending_with_the_owners_message()
    {
        await using var db = TestDatabases.Valuation("recall-decide-refused");
        var caseStudy = new EvaluatorRecallNoticeTests.FakeRecallReopen
        {
            Behaviour = () => Task.FromResult((false, (string?)"المهمة غير موجودة")),
        };
        var service = await ArrangeAsync(db, caseStudy);

        var (result, errors) = await service.DecideAsync(TaskKey, Approve());

        Assert.Null(result);
        Assert.Equal("المهمة غير موجودة", errors!["_"]);
        db.ChangeTracker.Clear();
        Assert.Equal(EvaluatorRecallStatus.Pending, (await db.EvaluatorRecallRecords.SingleAsync()).Status);
    }

    [Fact]
    public async Task A_retry_after_the_failure_succeeds_and_a_repeat_after_that_is_a_no_op()
    {
        await using var db = TestDatabases.Valuation("recall-decide-retry");
        var fail = true;
        var caseStudy = new EvaluatorRecallNoticeTests.FakeRecallReopen
        {
            Behaviour = () => fail
                ? throw new HttpRequestException("down")
                : Task.FromResult((true, (string?)null)),
        };
        var service = await ArrangeAsync(db, caseStudy);

        var first = await service.DecideAsync(TaskKey, Approve());
        Assert.NotNull(first.Errors);

        fail = false;
        var second = await service.DecideAsync(TaskKey, Approve());
        Assert.Equal(EvaluatorRecallStatus.Approved, second.Result!.Status);
        Assert.Equal(2, caseStudy.Calls.Count);

        // Decided already: the answer is the stored one and Case Study is not asked again.
        var third = await service.DecideAsync(TaskKey, Approve());
        Assert.Equal(EvaluatorRecallStatus.Approved, third.Result!.Status);
        Assert.Equal(2, caseStudy.Calls.Count);
        db.ChangeTracker.Clear();
        Assert.Single(await db.OutboxMessages
            .Where(x => x.EventType == IntegrationEventTypes.ValuationWorkflowNotice)
            .ToListAsync());
    }

    [Fact]
    public async Task A_deposited_report_refuses_the_approval_and_never_calls_case_study()
    {
        await using var db = TestDatabases.Valuation("recall-decide-deposited");
        var caseStudy = new EvaluatorRecallNoticeTests.FakeRecallReopen();
        var service = await ArrangeAsync(db, caseStudy);
        var request = ValuationRequest.Create(
            Guid.NewGuid(), "VR-1", PropertyId, "جدة", "فيلا", "مقيّم", "2026-09-01", DateTime.UtcNow);
        db.ValuationRequests.Add(request);
        db.ValuationReportIssuances.Add(
            ValuationReportIssuance.IssueDeposit(request.Id, "{}", "u1", DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (result, errors) = await service.DecideAsync(TaskKey, Approve());

        Assert.Null(result);
        Assert.Equal(EvaluatorRecallsService.DepositedRecallMessageAr, errors!["_"]);
        Assert.Empty(caseStudy.Calls);
        db.ChangeTracker.Clear();
        Assert.Equal(EvaluatorRecallStatus.Pending, (await db.EvaluatorRecallRecords.SingleAsync()).Status);
    }

    [Fact]
    public async Task A_superseded_deposit_does_not_block_the_recall()
    {
        await using var db = TestDatabases.Valuation("recall-decide-superseded");
        var caseStudy = new EvaluatorRecallNoticeTests.FakeRecallReopen();
        var service = await ArrangeAsync(db, caseStudy);
        var request = ValuationRequest.Create(
            Guid.NewGuid(), "VR-2", PropertyId, "جدة", "فيلا", "مقيّم", "2026-09-01", DateTime.UtcNow);
        db.ValuationRequests.Add(request);
        var old = ValuationReportIssuance.IssueDeposit(request.Id, "{}", "u1", DateTime.UtcNow);
        old.Supersede("u1", "إعادة فتح لخطأ في المساحة", DateTime.UtcNow);
        db.ValuationReportIssuances.Add(old);
        await db.SaveChangesAsync();

        var (result, errors) = await service.DecideAsync(TaskKey, Approve());

        Assert.Null(errors);
        Assert.Equal(EvaluatorRecallStatus.Approved, result!.Status);
    }

    [Fact]
    public async Task Reject_records_the_note_and_never_calls_case_study()
    {
        await using var db = TestDatabases.Valuation("recall-decide-reject");
        var caseStudy = new EvaluatorRecallNoticeTests.FakeRecallReopen();
        var service = await ArrangeAsync(db, caseStudy);

        var (result, errors) = await service.DecideAsync(
            TaskKey,
            new DecideEvaluatorRecallRequest { Decision = EvaluatorRecallDecisions.Reject, Note = "  التقرير سليم  " });

        Assert.Null(errors);
        Assert.Equal(EvaluatorRecallStatus.Rejected, result!.Status);
        Assert.Equal("التقرير سليم", result.SpecialistNote);
        Assert.Empty(caseStudy.Calls);
        Assert.Contains("رُفض استرجاع التقرير", await NoticesAsync(db));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("maybe")]
    public async Task A_missing_or_unknown_decision_is_a_field_error(string? decision)
    {
        await using var db = TestDatabases.Valuation("recall-decide-invalid");
        var service = await ArrangeAsync(db, new EvaluatorRecallNoticeTests.FakeRecallReopen());

        var (result, errors) = await service.DecideAsync(
            TaskKey, new DecideEvaluatorRecallRequest { Decision = decision });

        Assert.Null(result);
        Assert.Contains("decision", errors!.Keys);
    }

    [Fact]
    public async Task An_unknown_recall_is_not_found_not_an_error()
    {
        await using var db = TestDatabases.Valuation("recall-decide-missing");
        var service = await ArrangeAsync(db, new EvaluatorRecallNoticeTests.FakeRecallReopen());

        var (result, errors) = await service.DecideAsync(Guid.NewGuid().ToString("D"), Approve());

        Assert.Null(result);
        Assert.Null(errors);
    }

    private static async Task<EvaluatorRecallsService> ArrangeAsync(
        ValuationDbContext db,
        ICaseStudyRecallCommands caseStudy)
    {
        var service = new EvaluatorRecallsService(
            db,
            caseStudy,
            events: new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance));
        await service.RequestAsync(new CreateEvaluatorRecallRequest
        {
            TaskId = TaskKey,
            PropertyId = PropertyId.ToString("D"),
            PoNumber = "PO-RECALL-2C",
            Reason = "خطأ في المساحة",
        });
        // The request's own notice is not what these tests look at.
        db.OutboxMessages.RemoveRange(await db.OutboxMessages.ToListAsync());
        await db.SaveChangesAsync();
        return service;
    }

    private static async Task<string> NoticesAsync(ValuationDbContext db)
    {
        db.ChangeTracker.Clear();
        var rows = await db.OutboxMessages.AsNoTracking()
            .Where(x => x.EventType == IntegrationEventTypes.ValuationWorkflowNotice)
            .ToListAsync();
        return string.Join(" || ", rows.Select(r =>
        {
            using var doc = System.Text.Json.JsonDocument.Parse(r.PayloadJson);
            var payload = doc.RootElement.GetProperty("Payload");
            return payload.GetProperty("Title").GetString() + " | " + payload.GetProperty("Body").GetString();
        }));
    }
}
