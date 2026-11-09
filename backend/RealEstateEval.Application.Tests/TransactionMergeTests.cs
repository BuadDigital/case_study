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

/// <summary>
/// (stage condition Omar 2026-10-20: bourse done, inspection not required; numbering ruling 2026-11-08):
/// merging deeds into a linked property (root + «-L»), and taking a deed back out under its own number.
/// </summary>
public class TransactionMergeTests
{
    private static readonly PermissionsDto Specialist = new()
    {
        UserId = "u-spec",
        PrototypeRole = "case-specialist", SubRoles = CaseSpecialistSubRoles.All,
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
        var target = Transaction.Create(DateTime.UtcNow);
        var source = Transaction.Create(DateTime.UtcNow);
        var deed = new WorkOrderProperty { Id = Guid.NewGuid(), TransactionId = source.Id, DeedNumber = "1", BourseDataCompleted = true };

        Assert.Null(TransactionMergeRules.BlockedReason(deed, source, target.Id));
        var beforeBourse = new WorkOrderProperty { Id = Guid.NewGuid(), TransactionId = source.Id, DeedNumber = "2" };
        Assert.Equal(TransactionMergeRules.BoursePendingAr, TransactionMergeRules.BlockedReason(beforeBourse, source, target.Id));
        Assert.Equal(TransactionMergeRules.SameTransactionAr, TransactionMergeRules.BlockedReason(deed, source, source.Id));

        // A source whose number is locked (a report approved) cannot join.
        source.LockReference(DateTime.UtcNow);
        Assert.Equal(TransactionMergeRules.SourceConfirmedAr, TransactionMergeRules.BlockedReason(deed, source, target.Id));

        var merged = Transaction.Create(DateTime.UtcNow);
        merged.MergedIntoTransactionId = target.Id;
        Assert.Equal(TransactionMergeRules.SourceMergedAr, TransactionMergeRules.BlockedReason(deed, merged, target.Id));

        Assert.Equal(TransactionMergeRules.ReasonRequiredAr, TransactionMergeRules.ValidateReason("قصير"));
        Assert.Null(TransactionMergeRules.ValidateReason("مبنى واحد على الصكين"));
        Assert.Equal(TransactionMergeRules.LinkKindRequiredAr, TransactionMergeRules.ValidateLinkKind("x"));
    }

    [Fact]
    public async Task Merge_moves_the_source_deeds_closes_the_source_and_numbers_the_linked_property_from_the_smallest_deed()
    {
        await using var contexts = TestDatabases.Create("transaction-merge");
        var db = contexts.CaseStudy;
        var (target, a) = SeedDeed(db, "PO-1", "4213", "PR-26-00002", bourseDone: true);
        var (source, b) = SeedDeed(db, "PO-2", "4214", "PR-26-00001", bourseDone: true);
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
        // The root is the smallest deed number at merge time, even when it came with the source.
        Assert.Equal("PR-26-00001-L", result.DisplayNumber);
        Assert.Equal("PRV-26-00001-L", result.ValuationReportNumber);
        Assert.Contains(result.Deeds, d => d.PropertyId == a.Id && d.ReferenceNumber == "PR-26-00002");
        Assert.Equal(2, result.DeedCount);
        Assert.Equal(TransactionLinkKinds.OneBuilding, result.LinkKind);
        Assert.Contains(result.Deeds, d => d.PropertyId == b.Id && d.PoNumber == "PO-2");

        var closed = await db.Transactions.AsNoTracking().SingleAsync(t => t.Id == source.Id);
        Assert.Equal(target.Id, closed.MergedIntoTransactionId);
        Assert.Equal("u-spec", closed.MergedByUserId);
        Assert.Null(closed.ReferenceNumber);
        var movedDeed = await db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == b.Id);
        Assert.Equal(target.Id, movedDeed.TransactionId);
        Assert.Equal("PR-26-00001", movedDeed.ReferenceNumber);

        var timeline = await db.PropertyTimelineEntries.AsNoTracking().Where(e => e.PropertyId == b.Id).ToListAsync();
        Assert.Contains(timeline, e => e.Title.Contains("ضُم الصك إلى العقار المرتبط PR-26-00001-L", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Merge_refuses_a_deed_without_its_number()
    {
        await using var contexts = TestDatabases.Create("transaction-merge");
        var db = contexts.CaseStudy;
        var (target, _) = SeedDeed(db, "PO-1", "4213", "PR-26-00001", bourseDone: true);
        var (_, b) = SeedDeed(db, "PO-2", "4214", null, bourseDone: true);
        await db.SaveChangesAsync();

        var (_, error) = await CreateService(contexts).MergeAsync(
            target.Id,
            new MergeTransactionsRequest { PropertyIds = [b.Id], LinkKind = TransactionLinkKinds.OneBuilding, Reason = "مبنى واحد على الصكين" },
            Specialist);

        Assert.NotNull(error);
        Assert.Contains(TransactionMergeRules.DeedNotNumberedAr, error!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Merge_refuses_a_deed_before_its_bourse_inquiry_and_a_non_specialist()
    {
        await using var contexts = TestDatabases.Create("transaction-merge");
        var db = contexts.CaseStudy;
        var (target, _) = SeedDeed(db, "PO-1", "4213", "PR-26-00001", bourseDone: true);
        var (_, b) = SeedDeed(db, "PO-2", "4214", "PR-26-00002", bourseDone: false);
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
    public async Task Unmerge_returns_the_deed_under_its_own_number_only_before_the_first_approval()
    {
        await using var contexts = TestDatabases.Create("transaction-merge");
        var db = contexts.CaseStudy;
        var (target, a) = SeedDeed(db, "PO-1", "4213", "PR-26-00002", bourseDone: true);
        var (_, b) = SeedDeed(db, "PO-2", "4214", "PR-26-00001", bourseDone: true);
        await db.SaveChangesAsync();
        var service = CreateService(contexts);
        var (merged, mergeError) = await service.MergeAsync(
            target.Id,
            new MergeTransactionsRequest { PropertyIds = [b.Id], LinkKind = TransactionLinkKinds.OneBuilding, Reason = "مبنى واحد على الصكين" },
            Specialist);
        Assert.Null(mergeError);
        Assert.Equal(2, merged!.DeedCount);
        Assert.Equal("PR-26-00001-L", merged.DisplayNumber);

        // The root deed (PR-26-00001) leaves: the property is single again, under the other deed's number.
        var (after, error) = await service.UnmergeDeedAsync(
            target.Id,
            new UnmergeTransactionDeedRequest { PropertyId = b.Id, Reason = "ضُم بالخطأ — صك آخر" },
            Specialist);
        Assert.Null(error);
        Assert.Equal(1, after!.DeedCount);
        Assert.Null(after.LinkKind);
        Assert.Equal("PR-26-00002", after.DisplayNumber);

        var deed = await db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == b.Id);
        Assert.NotEqual(target.Id, deed.TransactionId);
        var fresh = await db.Transactions.AsNoTracking().SingleAsync(t => t.Id == deed.TransactionId);
        Assert.Equal("PR-26-00001", fresh.ReferenceNumber);
        Assert.Null(fresh.DraftNumber);

        // Merged again and a report approved (the number locked): nothing comes out any more.
        var (_, remergeError) = await service.MergeAsync(
            target.Id,
            new MergeTransactionsRequest { PropertyIds = [b.Id], LinkKind = TransactionLinkKinds.OneBuilding, Reason = "مبنى واحد على الصكين" },
            Specialist);
        Assert.Null(remergeError);
        var tracked = await db.Transactions.SingleAsync(t => t.Id == target.Id);
        tracked.LockReference(DateTime.UtcNow);
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
        var (target, _) = SeedDeed(db, "PO-1", "4213", "PR-26-00001", bourseDone: true);
        SeedDeed(db, "PO-2", "4214", "PR-26-00002", bourseDone: true);
        SeedDeed(db, "PO-3", "4215", "PR-26-00003", bourseDone: false);
        await db.SaveChangesAsync();

        var hits = await CreateService(contexts).SearchDeedsAsync(target.Id, "421", Specialist);
        Assert.Equal(3, hits.Count);
        Assert.Equal(TransactionMergeRules.SameTransactionAr, hits.Single(h => h.DeedNumber == "4213").BlockedReasonAr);
        Assert.Null(hits.Single(h => h.DeedNumber == "4214").BlockedReasonAr);
        Assert.Equal(TransactionMergeRules.BoursePendingAr, hits.Single(h => h.DeedNumber == "4215").BlockedReasonAr);
        Assert.Equal("PR-26-00002", hits.Single(h => h.DeedNumber == "4214").TransactionNumber);
        // «رقم المعاملة» is searchable too.
        var byNumber = await CreateService(contexts).SearchDeedsAsync(target.Id, "00003", Specialist);
        Assert.Equal("4215", Assert.Single(byNumber).DeedNumber);
    }

    private static TransactionCommandService CreateService(TestDatabases.ContextSet contexts)
    {
        var db = contexts.CaseStudy;
        var visibility = new WorkOrderVisibilityFilter(db);
        var timeline = new PropertyTimelineService(db, new FailureLookup(contexts.Failures));
        var query = new TransactionQueryService(db, visibility, timeline);
        return new TransactionCommandService(db, query, visibility, timeline);
    }

    private static (Transaction Transaction, WorkOrderProperty Deed) SeedDeed(
        RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudyDbContext db,
        string po,
        string deedNumber,
        string? referenceNumber,
        bool bourseDone)
    {
        var now = DateTime.UtcNow;
        // A single deed: the property number is the deed's own number (null while not numbered).
        var transaction = Transaction.Create(now);
        transaction.ReferenceNumber = referenceNumber;
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
            ReferenceNumber = referenceNumber,
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
