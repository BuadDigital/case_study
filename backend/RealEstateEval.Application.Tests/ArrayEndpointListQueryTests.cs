using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Persistence;
using RealEstateEval.Financial.Application.Contracts;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Platform.Infrastructure.Notifications;
using RealEstateEval.Platform.Infrastructure.Services;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Filter / sort / page behaviour of the array endpoints added in
/// docs/architecture/pagination-contract.md §§4-7, over the in-memory provider. Everything asserted
/// here is produced by the query itself, so a page and its count always agree.
/// </summary>
public class ComparablePropertyListQueryTests
{
    private static readonly Guid Subject = Guid.Parse("aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa");

    [Fact]
    public async Task Page_and_count_agree_over_the_same_filters()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new ComparablePropertyRepository(db);
        var filter = Filter();

        var total = await repo.CountAsync(filter, default);
        var first = await repo.ListPageAsync(filter, 0, 2, default);
        var second = await repo.ListPageAsync(filter, 2, 2, default);

        Assert.Equal(4, total);
        Assert.Equal(2, first.Count);
        Assert.Equal(2, second.Count);
        Assert.Empty(first.Select(x => x.Id).Intersect(second.Select(x => x.Id)));
    }

    [Fact]
    public async Task Inactive_rows_are_excluded_unless_asked_for()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new ComparablePropertyRepository(db);

        Assert.Equal(4, await repo.CountAsync(Filter(), default));
        Assert.Equal(5, await repo.CountAsync(Filter() with { IncludeInactive = true }, default));
    }

    [Theory]
    [InlineData(ComparablePropertyListSortKey.Price, true, "C-EXPENSIVE")]
    [InlineData(ComparablePropertyListSortKey.Price, false, "C-CHEAP")]
    [InlineData(ComparablePropertyListSortKey.Area, true, "C-BIG")]
    [InlineData(ComparablePropertyListSortKey.District, false, "C-CHEAP")]
    public async Task Sort_keys_order_by_their_column(
        ComparablePropertyListSortKey sort,
        bool descending,
        string expectedFirst)
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new ComparablePropertyRepository(db);

        var rows = await repo.ListPageAsync(
            Filter() with { Sort = sort, Descending = descending },
            0,
            10,
            default);

        Assert.Equal(expectedFirst, rows[0].ReferenceCode);
    }

    /// <summary>
    /// The comparison-method §2 priority is now part of the SQL ordering, so it survives paging:
    /// the subject's own field comparable is on page 1 whatever the sort.
    /// </summary>
    [Fact]
    public async Task Subject_property_priority_survives_paging()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new ComparablePropertyRepository(db);

        var rows = await repo.ListPageAsync(
            Filter() with { ForPropertyId = Subject, Sort = ComparablePropertyListSortKey.Price },
            0,
            1,
            default);

        Assert.Equal("C-FIELD", rows.Single().ReferenceCode);
    }

    [Fact]
    public async Task Search_covers_the_documented_columns()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new ComparablePropertyRepository(db);

        var rows = await repo.ListPageAsync(
            Filter() with { Search = "C-BIG" },
            0,
            10,
            default);

        Assert.Equal("C-BIG", rows.Single().ReferenceCode);
    }

    private static ComparableBankFilter Filter() =>
        new(false, null, null, null, null, null, null, null, null, null);

    private static void Seed(ValuationDbContext db)
    {
        db.ComparableProperties.AddRange(
            Row("C-CHEAP", 100_000m, 200m, "الروضة", new DateOnly(2026, 1, 5)),
            Row("C-EXPENSIVE", 900_000m, 300m, "النرجس", new DateOnly(2026, 2, 5)),
            Row("C-BIG", 500_000m, 900m, "الملقا", new DateOnly(2026, 3, 5)),
            Row("C-FIELD", 200_000m, 250m, "الياسمين", new DateOnly(2026, 4, 5),
                source: ComparableSources.Field,
                sourcePropertyId: Subject),
            Row("C-DEAD", 700_000m, 400m, "حطين", new DateOnly(2026, 5, 5), isActive: false));
        db.SaveChanges();
    }

    private static ComparableProperty Row(
        string referenceCode,
        decimal price,
        decimal areaSqm,
        string district,
        DateOnly transactionDate,
        string? source = null,
        Guid? sourcePropertyId = null,
        bool isActive = true) => new()
        {
            Id = Guid.NewGuid(),
            ReferenceCode = referenceCode,
            ComparablePropertyType = "سكني",
            District = district,
            Price = price,
            AreaSqm = areaSqm,
            PricePerSqm = areaSqm == 0 ? 0 : price / areaSqm,
            TransactionDate = transactionDate,
            Source = source ?? ComparableSources.Other,
            SourcePropertyId = sourcePropertyId,
            IsActive = isActive,
            CreatedAtUtc = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAtUtc = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
        };

    private static ValuationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ValuationDbContext>()
            .UseInMemoryDatabase($"comparables-{Guid.NewGuid():N}")
            .Options);
}

public class FailureListQueryTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Page_and_count_agree_and_visibility_narrows_both()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new FailureRepository(db);

        var everything = await repo.CountAsync(null, FailureListQuery.Empty, default);
        var mine = await repo.CountAsync(["PO-1"], FailureListQuery.Empty, default);
        var page = await repo.ListPageAsync(["PO-1"], FailureListQuery.Empty, 0, 10, default);

        Assert.Equal(3, everything);
        Assert.Equal(2, mine);
        Assert.Equal(2, page.Count);
    }

    /// <summary>An actor with an empty visibility set sees nothing, and the count says nothing.</summary>
    [Fact]
    public async Task An_actor_who_sees_nothing_gets_zero()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new FailureRepository(db);

        Assert.Equal(0, await repo.CountAsync([], FailureListQuery.Empty, default));
        Assert.Empty(await repo.ListPageAsync([], FailureListQuery.Empty, 0, 10, default));
    }

    [Fact]
    public async Task Status_filter_accepts_a_comma_separated_list()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new FailureRepository(db);

        var query = new FailureListQuery { Status = "review,suspended" };

        Assert.Equal(2, await repo.CountAsync(null, query, default));
    }

    [Fact]
    public async Task Search_covers_po_deed_title_and_specialist()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new FailureRepository(db);

        Assert.Equal(1, await repo.CountAsync(null, new FailureListQuery { Q = "77123" }, default));
        Assert.Equal(1, await repo.CountAsync(null, new FailureListQuery { Q = "سلمى" }, default));
        Assert.Equal(2, await repo.CountAsync(null, new FailureListQuery { Q = "PO-1" }, default));
    }

    [Theory]
    [InlineData("po", "asc", "PO-1")]
    [InlineData("po", "desc", "PO-2")]
    [InlineData("deed", "asc", "PO-1")]
    public async Task Sort_keys_order_by_their_column(string sort, string dir, string expectedFirstPo)
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new FailureRepository(db);

        var rows = await repo.ListPageAsync(
            null,
            new FailureListQuery { Sort = sort, Dir = dir },
            0,
            10,
            default);

        Assert.Equal(expectedFirstPo, rows[0].PoNumber);
    }

    /// <summary>Consecutive pages never overlap — the id tiebreaker makes the order total.</summary>
    [Fact]
    public async Task Consecutive_pages_do_not_overlap()
    {
        await using var db = CreateDb();
        Seed(db);
        var repo = new FailureRepository(db);

        var first = await repo.ListPageAsync(null, FailureListQuery.Empty, 0, 2, default);
        var second = await repo.ListPageAsync(null, FailureListQuery.Empty, 2, 2, default);

        Assert.Equal(2, first.Count);
        Assert.Single(second);
        Assert.Empty(first.Select(f => f.Id).Intersect(second.Select(f => f.Id)));
    }

    private static void Seed(FailuresDbContext db)
    {
        db.PropertyFailures.AddRange(
            Failure("PO-1", "77123", "صك مفقود", "أحمد", PropertyFailureStatus.Internal),
            Failure("PO-1", "77124", "حدود غير واضحة", "سلمى", PropertyFailureStatus.Review),
            Failure("PO-2", "88001", "تعذر الوصول", "خالد", PropertyFailureStatus.Suspended));
        db.SaveChanges();
    }

    private static PropertyFailure Failure(
        string poNumber,
        string deedNumber,
        string title,
        string specialist,
        string status)
    {
        var failure = PropertyFailure.Create(
            Guid.NewGuid(),
            poNumber,
            Guid.NewGuid().ToString(),
            deedNumber,
            title,
            "problem-1",
            PropertyFailureSeverity.Internal,
            "case-specialist",
            "ملاحظة",
            specialist,
            Now);

        if (status == PropertyFailureStatus.Review) failure.TrySubmitForReview(Now);
        if (status == PropertyFailureStatus.Suspended)
        {
            failure.TrySubmitForReview(Now);
            failure.TrySuspend("تعليق", "user-1", Now);
        }

        return failure;
    }

    private static FailuresDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<FailuresDbContext>()
            .UseInMemoryDatabase($"failures-list-{Guid.NewGuid():N}")
            .Options);
}

public class NotificationListQueryTests
{
    [Fact]
    public async Task Page_and_count_are_scoped_to_the_signed_in_user()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        Seed(db);

        var page = await service.ListPagedForUserAsync(
            "user-1",
            NotificationListQuery.Empty,
            0,
            2,
            1);

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(2, page.Items.Count);
    }

    [Fact]
    public async Task Unread_filter_is_a_tri_state()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        Seed(db);

        var unread = await service.ListPagedForUserAsync(
            "user-1", new NotificationListQuery { Unread = true }, 0, 10, 1);
        var read = await service.ListPagedForUserAsync(
            "user-1", new NotificationListQuery { Unread = false }, 0, 10, 1);

        Assert.Equal(2, unread.TotalCount);
        Assert.Equal(1, read.TotalCount);
    }

    [Fact]
    public async Task Category_and_search_narrow_the_feed()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        Seed(db);

        var byCategory = await service.ListPagedForUserAsync(
            "user-1", new NotificationListQuery { Category = "billing" }, 0, 10, 1);
        var bySearch = await service.ListPagedForUserAsync(
            "user-1", new NotificationListQuery { Q = "توزيع" }, 0, 10, 1);

        Assert.Equal(1, byCategory.TotalCount);
        Assert.Equal(1, bySearch.TotalCount);
    }

    /// <summary>Without a page the feed keeps its plain array, still capped at 50.</summary>
    [Fact]
    public async Task Plain_list_still_returns_an_array()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        Seed(db);

        var rows = await service.ListForUserAsync("user-1");

        Assert.Equal(3, rows.Count);
    }

    private static void Seed(MessagingDbContext db)
    {
        db.UserNotifications.AddRange(
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = "user-1",
                Title = "توزيع مهمة",
                Category = "workflow",
                CreatedAtUtc = new DateTime(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc),
            },
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = "user-1",
                Title = "فاتورة جديدة",
                Category = "billing",
                CreatedAtUtc = new DateTime(2026, 9, 1, 9, 0, 0, DateTimeKind.Utc),
            },
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = "user-1",
                Title = "تنبيه مقروء",
                Category = "workflow",
                CreatedAtUtc = new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc),
                ReadAtUtc = new DateTime(2026, 9, 1, 11, 0, 0, DateTimeKind.Utc),
            },
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = "user-2",
                Title = "لغيره",
                CreatedAtUtc = new DateTime(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc),
            });
        db.SaveChanges();
    }

    private static NotificationService CreateService(MessagingDbContext db) =>
        new(
            db,
            new MessagingOutboxPublisher(db, NullLogger<MessagingOutboxPublisher>.Instance),
            new NotificationRealtimeHub());

    private static MessagingDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<MessagingDbContext>()
            .UseInMemoryDatabase($"notifications-{Guid.NewGuid():N}")
            .Options);
}

public class FinancialLedgerListQueryTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Discount_flag_page_and_count_agree()
    {
        var (fin, caseStudy, identity) = CreateStore();
        SeedFlags(fin);
        var service = new DiscountFlagService(fin, new CaseStudyLookup(caseStudy));

        var page = await service.ListPagedAsync(DiscountFlagListQuery.Empty, 0, 2, 1);

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(2, page.Items.Count);
        identity.Dispose();
    }

    [Fact]
    public async Task Discount_flag_filters_stay_exact()
    {
        var (fin, caseStudy, identity) = CreateStore();
        SeedFlags(fin);
        var service = new DiscountFlagService(fin, new CaseStudyLookup(caseStudy));

        var byStatus = await service.ListPagedAsync(
            new DiscountFlagListQuery { Status = DiscountFlagStatuses.Approved }, 0, 10, 1);
        var byKey = await service.ListPagedAsync(
            new DiscountFlagListQuery { TransactionKey = "PO-A" }, 0, 10, 1);
        var bySearch = await service.ListPagedAsync(
            new DiscountFlagListQuery { Q = "تأخير" }, 0, 10, 1);

        Assert.Equal(1, byStatus.TotalCount);
        Assert.Equal(2, byKey.TotalCount);
        Assert.Equal(1, bySearch.TotalCount);
        identity.Dispose();
    }

    [Fact]
    public async Task Incentive_suspension_active_only_defaults_to_true()
    {
        var (fin, caseStudy, identity) = CreateStore();
        SeedSuspensions(fin);
        var service = new IncentiveSuspensionService(fin, new IdentityDirectory(identity));

        var active = await service.ListPagedAsync(IncentiveSuspensionListQuery.Empty, 0, 10, 1);
        var all = await service.ListPagedAsync(
            new IncentiveSuspensionListQuery { ActiveOnly = false }, 0, 10, 1);

        Assert.Equal(2, active.TotalCount);
        Assert.Equal(3, all.TotalCount);
        caseStudy.Dispose();
    }

    [Fact]
    public async Task Incentive_suspension_sort_by_transaction_key_is_allow_listed()
    {
        var (fin, caseStudy, identity) = CreateStore();
        SeedSuspensions(fin);
        var service = new IncentiveSuspensionService(fin, new IdentityDirectory(identity));

        var page = await service.ListPagedAsync(
            new IncentiveSuspensionListQuery
            {
                ActiveOnly = false,
                Sort = "transaction",
                Dir = "asc",
            },
            0,
            10,
            1);

        Assert.Equal("PO-A", page.Items[0].TransactionKey);
        caseStudy.Dispose();
    }

    private static void SeedFlags(FinancialDbContext fin)
    {
        fin.DiscountFlags.AddRange(
            Flag("PO-A", "insp-1", "تأخير معاينة", DiscountFlagStatuses.Pending),
            Flag("PO-A", "insp-2", "نقص مستندات", DiscountFlagStatuses.Approved),
            Flag("PO-B", "insp-3", "نقص مستندات", DiscountFlagStatuses.Rejected));
        fin.SaveChanges();
    }

    private static DiscountFlag Flag(
        string transactionKey,
        string targetAssigneeId,
        string reason,
        string status) => new()
        {
            Id = Guid.NewGuid(),
            TransactionKey = transactionKey,
            TargetAssigneeId = targetAssigneeId,
            FlaggedByUserId = "user-1",
            Reason = reason,
            ProposedDiscountSar = 50m,
            Status = status,
            CreatedAtUtc = Now,
        };

    private static void SeedSuspensions(FinancialDbContext fin)
    {
        fin.IncentiveSuspensions.AddRange(
            Suspension("PO-A", "insp-1", lifted: false),
            Suspension("PO-B", "insp-2", lifted: false),
            Suspension("PO-C", "insp-3", lifted: true));
        fin.SaveChanges();
    }

    private static IncentiveSuspension Suspension(
        string transactionKey,
        string assigneeId,
        bool lifted) => new()
        {
            Id = Guid.NewGuid(),
            UserId = "user-1",
            AssigneeId = assigneeId,
            TransactionKey = transactionKey,
            Reason = "إيقاف حافز",
            CreatedByUserId = "user-1",
            CreatedAtUtc = Now,
            LiftedAtUtc = lifted ? Now.AddHours(1) : null,
        };

    private static (FinancialDbContext Fin,
        RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudyDbContext CaseStudy,
        IdentityDbContext Identity) CreateStore()
    {
        var name = $"fin-ledger-{Guid.NewGuid():N}";
        var root = new InMemoryDatabaseRoot();
        var fin = new FinancialDbContext(new DbContextOptionsBuilder<FinancialDbContext>()
            .UseInMemoryDatabase(name, root)
            .Options);
        var caseStudy = new RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudyDbContext(
            new DbContextOptionsBuilder<
                RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudyDbContext>()
                .UseInMemoryDatabase(name, root)
                .Options);
        var identity = new IdentityDbContext(new DbContextOptionsBuilder<IdentityDbContext>()
            .UseInMemoryDatabase(name, root)
            .Options);
        return (fin, caseStudy, identity);
    }
}
