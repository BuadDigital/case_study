using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Services;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>(stage condition Omar 2026-10-20: bourse done, inspection not required): merging deeds' transactions, and taking a deed back out.</summary>
public class TransactionMergeTests
{
    private static readonly PermissionsDto Specialist = new()
    {
        UserId = "u-spec",
        PrototypeRole = "case-specialist",
        DisplayName = "أسامة",
    };

    private static readonly PermissionsDto Appraiser = new()
    {
        UserId = "u-app",
        PrototypeRole = "real-estate-appraiser",
    };

    [Fact]
    public void Blocked_reasons_follow_the_decision()
    {
        var target = Transaction.CreateDraft("TMP-26-00001", DateTime.UtcNow);
        var source = Transaction.CreateDraft("TMP-26-00002", DateTime.UtcNow);
        var deed = new WorkOrderProperty { Id = Guid.NewGuid(), TransactionId = source.Id, DeedNumber = "1", BourseDataCompleted = true };

        Assert.Null(TransactionMergeRules.BlockedReason(deed, source, target.Id));
        var beforeBourse = new WorkOrderProperty { Id = Guid.NewGuid(), TransactionId = source.Id, DeedNumber = "2" };
        Assert.Equal(TransactionMergeRules.BoursePendingAr, TransactionMergeRules.BlockedReason(beforeBourse, source, target.Id));
        Assert.Equal(TransactionMergeRules.SameTransactionAr, TransactionMergeRules.BlockedReason(deed, source, source.Id));

        source.Confirm("PR-2026-00009", DateTime.UtcNow);
        Assert.Equal(TransactionMergeRules.SourceConfirmedAr, TransactionMergeRules.BlockedReason(deed, source, target.Id));

        var merged = Transaction.CreateDraft("TMP-26-00003", DateTime.UtcNow);
        merged.MergedIntoTransactionId = target.Id;
        Assert.Equal(TransactionMergeRules.SourceMergedAr, TransactionMergeRules.BlockedReason(deed, merged, target.Id));

        Assert.Equal(TransactionMergeRules.ReasonRequiredAr, TransactionMergeRules.ValidateReason("قصير"));
        Assert.Null(TransactionMergeRules.ValidateReason("مبنى واحد على الصكين"));
        Assert.Equal(TransactionMergeRules.LinkKindRequiredAr, TransactionMergeRules.ValidateLinkKind("x"));
    }

    [Fact]
    public async Task Merge_moves_the_source_deeds_closes_the_source_and_keeps_the_target_number()
    {
        await using var contexts = TestDatabases.Create("transaction-merge");
        var db = contexts.CaseStudy;
        var (target, a) = SeedDeed(db, "PO-1", "4213", "TMP-26-00001", bourseDone: true);
        var (source, b) = SeedDeed(db, "PO-2", "4214", "TMP-26-00002", bourseDone: true);
        await db.SaveChangesAsync();

        var service = CreateService(contexts);
        var (result, error) = await service.MergeAsync(
            target.Id,
            new MergeTransactionsRequest
            {
                PropertyIds = [b.Id],
                LinkKind = TransactionLinkKinds.OneBuilding,
                Reason = "مبنى واحد على الصكين",
            },
            Specialist);

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(target.Id, result!.Id);
        Assert.Equal("TMP-26-00001", result.DisplayNumber);
        Assert.Equal(2, result.DeedCount);
        Assert.Equal(TransactionLinkKinds.OneBuilding, result.LinkKind);
        Assert.Contains(result.Deeds, d => d.PropertyId == b.Id && d.PoNumber == "PO-2");

        var closed = await db.Transactions.AsNoTracking().SingleAsync(t => t.Id == source.Id);
        Assert.Equal(target.Id, closed.MergedIntoTransactionId);
        Assert.Equal("u-spec", closed.MergedByUserId);
        var movedDeed = await db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == b.Id);
        Assert.Equal(target.Id, movedDeed.TransactionId);

        var timeline = await db.PropertyTimelineEntries.AsNoTracking().Where(e => e.PropertyId == b.Id).ToListAsync();
        Assert.Contains(timeline, e => e.Title.Contains("ضُم الصك إلى المعاملة TMP-26-00001", StringComparison.Ordinal));
        _ = a;
    }

    [Fact]
    public async Task Merge_refuses_a_deed_before_its_bourse_inquiry_and_a_non_specialist()
    {
        await using var contexts = TestDatabases.Create("transaction-merge");
        var db = contexts.CaseStudy;
        var (target, _) = SeedDeed(db, "PO-1", "4213", "TMP-26-00001", bourseDone: true);
        var (_, b) = SeedDeed(db, "PO-2", "4214", "TMP-26-00002", bourseDone: false);
        await db.SaveChangesAsync();

        var service = CreateService(contexts);
        var request = new MergeTransactionsRequest
        {
            PropertyIds = [b.Id],
            LinkKind = TransactionLinkKinds.Contract,
            Reason = "عقد ملزم بالبيع معًا",
        };

        var (_, roleError) = await service.MergeAsync(target.Id, request, Appraiser);
        Assert.Equal(TransactionCommandService.RoleDeniedAr, roleError);

        var (_, gateError) = await service.MergeAsync(target.Id, request, Specialist);
        Assert.NotNull(gateError);
        Assert.Contains(TransactionMergeRules.BoursePendingAr, gateError!, StringComparison.Ordinal);
        Assert.Equal(1, await db.Transactions.CountAsync(t => t.MergedIntoTransactionId == null && t.Id == target.Id));
        Assert.Null((await db.Transactions.AsNoTracking().SingleAsync(t => t.Id != target.Id)).MergedIntoTransactionId);
    }

    [Fact]
    public async Task Unmerge_opens_a_new_draft_transaction_for_the_deed_only_before_the_official_number()
    {
        await using var contexts = TestDatabases.Create("transaction-merge");
        var db = contexts.CaseStudy;
        var (target, a) = SeedDeed(db, "PO-1", "4213", "TMP-26-00001", bourseDone: true);
        var (_, b) = SeedDeed(db, "PO-2", "4214", "TMP-26-00002", bourseDone: true);
        await db.SaveChangesAsync();
        var service = CreateService(contexts);
        var (merged, mergeError) = await service.MergeAsync(
            target.Id,
            new MergeTransactionsRequest { PropertyIds = [b.Id], LinkKind = TransactionLinkKinds.OneBuilding, Reason = "مبنى واحد على الصكين" },
            Specialist);
        Assert.Null(mergeError);
        Assert.Equal(2, merged!.DeedCount);

        var (after, error) = await service.UnmergeDeedAsync(
            target.Id,
            new UnmergeTransactionDeedRequest { PropertyId = b.Id, Reason = "ضُم بالخطأ — صك آخر" },
            Specialist);
        Assert.Null(error);
        Assert.Equal(1, after!.DeedCount);
        Assert.Null(after.LinkKind);

        var deed = await db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == b.Id);
        Assert.NotEqual(target.Id, deed.TransactionId);
        var fresh = await db.Transactions.AsNoTracking().SingleAsync(t => t.Id == deed.TransactionId);
        Assert.StartsWith("TMP-", fresh.DraftNumber);
        Assert.Null(fresh.ReferenceNumber);

        // Once the official number exists nothing comes out.
        var tracked = await db.Transactions.SingleAsync(t => t.Id == target.Id);
        tracked.Confirm("PR-2026-00001", DateTime.UtcNow);
        await db.SaveChangesAsync();
        var (_, confirmedError) = await service.UnmergeDeedAsync(
            target.Id,
            new UnmergeTransactionDeedRequest { PropertyId = a.Id, Reason = "محاولة بعد التثبيت" },
            Specialist);
        Assert.Equal(TransactionMergeRules.ConfirmedNoUnmergeAr, confirmedError);
    }

    [Fact]
    public async Task Deed_search_tells_which_deeds_can_join()
    {
        await using var contexts = TestDatabases.Create("transaction-merge");
        var db = contexts.CaseStudy;
        var (target, _) = SeedDeed(db, "PO-1", "4213", "TMP-26-00001", bourseDone: true);
        SeedDeed(db, "PO-2", "4214", "TMP-26-00002", bourseDone: true);
        SeedDeed(db, "PO-3", "4215", "TMP-26-00003", bourseDone: false);
        await db.SaveChangesAsync();

        var hits = await CreateService(contexts).SearchDeedsAsync(target.Id, "421", Specialist);
        Assert.Equal(3, hits.Count);
        Assert.Equal(TransactionMergeRules.SameTransactionAr, hits.Single(h => h.DeedNumber == "4213").BlockedReasonAr);
        Assert.Null(hits.Single(h => h.DeedNumber == "4214").BlockedReasonAr);
        Assert.Equal(TransactionMergeRules.BoursePendingAr, hits.Single(h => h.DeedNumber == "4215").BlockedReasonAr);
        Assert.Equal("TMP-26-00002", hits.Single(h => h.DeedNumber == "4214").TransactionNumber);
    }

    private static TransactionCommandService CreateService(TestDatabases.ContextSet contexts)
    {
        var db = contexts.CaseStudy;
        var visibility = new WorkOrderVisibilityFilter(db);
        var timeline = new PropertyTimelineService(db, new FailureLookup(contexts.Failures));
        var query = new TransactionQueryService(db, visibility, timeline);
        return new TransactionCommandService(db, new TransactionRepository(db), query, visibility, timeline);
    }

    private static (Transaction Transaction, WorkOrderProperty Deed) SeedDeed(
        RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudyDbContext db,
        string po,
        string deedNumber,
        string draftNumber,
        bool bourseDone)
    {
        var now = DateTime.UtcNow;
        var transaction = Transaction.CreateDraft(draftNumber, now);
        var order = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now).AddDays(5),
            CreatedAtUtc = now,
        };
        var deed = new WorkOrderProperty
        {
            Id = Guid.NewGuid(),
            WorkOrderId = order.Id,
            TransactionId = transaction.Id,
            Transaction = transaction,
            DeedNumber = deedNumber,
            BourseDataCompleted = bourseDone,
            City = "جدة",
            District = "الروضة",
            UpdatedAtUtc = now,
        };
        order.Properties.Add(deed);
        db.Transactions.Add(transaction);
        db.WorkOrders.Add(order);
        return (transaction, deed);
    }
}
