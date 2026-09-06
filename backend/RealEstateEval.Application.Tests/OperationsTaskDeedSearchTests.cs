using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Persistence;
using RealEstateEval.Operations.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Deed-number search on GET /api/operations-tasks. The literals are pure rules; the predicate is
/// index-backed on PostgreSQL (jsonb containment + a trigram LIKE over the generated DeedsText
/// column) and falls back to a plain LINQ substring on the in-memory provider, which has neither.
/// The SQL half is proved by the container test; these cover the rules and the fallback rows.
/// See docs/architecture/pagination-contract.md §3.
/// </summary>
public class OperationsTaskDeedSearchTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);
    private const string Manager = "case-specialist";

    [Fact]
    public void Containment_json_is_a_one_element_array()
    {
        Assert.Equal("[\"310107029844\"]", OperationsTaskDeedSearch.ContainmentJson("310107029844"));
    }

    /// <summary>A quote in the search text must not break out of the JSON array literal.</summary>
    [Fact]
    public void Containment_json_escapes_the_search_text()
    {
        var json = OperationsTaskDeedSearch.ContainmentJson("a\"b");

        Assert.Equal(["a\"b"], System.Text.Json.JsonSerializer.Deserialize<string[]>(json)!);
    }

    [Fact]
    public void Substring_pattern_wraps_the_search_text()
    {
        Assert.Equal("%3101%", OperationsTaskDeedSearch.SubstringPattern("3101"));
    }

    /// <summary>Otherwise a user typing <c>%</c> would match every row.</summary>
    [Theory]
    [InlineData("50%", "%50\\%%")]
    [InlineData("a_b", "%a\\_b%")]
    [InlineData("a\\b", "%a\\\\b%")]
    public void Substring_pattern_escapes_like_metacharacters(string search, string expected)
    {
        Assert.Equal(expected, OperationsTaskDeedSearch.SubstringPattern(search));
    }

    [Fact]
    public async Task Search_matches_a_whole_deed_number()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 10, Q = "310107029844" },
            "manager-1",
            null,
            Manager);

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("T-DEED-A", page.Items.Single().DisplayId);
    }

    [Fact]
    public async Task Search_matches_part_of_a_deed_number()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 10, Q = "029844" },
            "manager-1",
            null,
            Manager);

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("T-DEED-A", page.Items.Single().DisplayId);
    }

    /// <summary>A task can carry several deeds; any of them matches.</summary>
    [Fact]
    public async Task Search_matches_any_deed_on_the_task()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 10, Q = "550002" },
            "manager-1",
            null,
            Manager);

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("T-DEED-B", page.Items.Single().DisplayId);
    }

    /// <summary>The count and the page agree — the deed match is a predicate, not a post-filter.</summary>
    [Fact]
    public async Task Deed_search_narrows_the_total_as_well_as_the_page()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 10, Q = "زيارة" },
            "manager-1",
            null,
            Manager);

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("T-PLAIN", page.Items.Single().DisplayId);
    }

    [Fact]
    public async Task A_deed_that_matches_nothing_returns_nothing()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 10, Q = "000000000" },
            "manager-1",
            null,
            Manager);

        Assert.Equal(0, page.TotalCount);
        Assert.Empty(page.Items);
    }

    private static void Seed(OperationsDbContext ops)
    {
        ops.OperationsTasks.AddRange(
            Task("T-DEED-A", "مهمة أ", "[\"310107029844\"]", Now.AddHours(-3)),
            Task("T-DEED-B", "مهمة ب", "[\"440001\",\"550002\"]", Now.AddHours(-2)),
            Task("T-PLAIN", "زيارة دائرة", null, Now.AddHours(-1)));
        ops.SaveChanges();
    }

    private static OperationsTask Task(
        string displayId,
        string title,
        string? deedsJson,
        DateTime createdAtUtc) =>
        OperationsTask.Create(
            Guid.NewGuid(),
            displayId,
            OperationsTaskType.CourtVisit,
            title,
            OperationsTaskScope.General,
            "assignee-a",
            "creator-1",
            OperationsTaskPriority.Medium,
            createdAtUtc.AddHours(24),
            createdAtUtc,
            deedsJson: deedsJson,
            assigneeName: "منفّذ أ",
            createdByName: "منشئ");

    private static (OperationsTaskQueryService Query, OperationsDbContext Ops) Create()
    {
        var name = $"ops-deed-search-{Guid.NewGuid():N}";
        var root = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
        var ops = new OperationsDbContext(new DbContextOptionsBuilder<OperationsDbContext>()
            .UseInMemoryDatabase(name, root)
            .Options);
        var fin = new RealEstateEval.Financial.Infrastructure.Data.Contexts.FinancialDbContext(
            new DbContextOptionsBuilder<
                RealEstateEval.Financial.Infrastructure.Data.Contexts.FinancialDbContext>()
                .UseInMemoryDatabase(name, root)
                .Options);
        var identity = new RealEstateEval.Identity.Infrastructure.Data.Contexts.IdentityDbContext(
            new DbContextOptionsBuilder<
                RealEstateEval.Identity.Infrastructure.Data.Contexts.IdentityDbContext>()
                .UseInMemoryDatabase(name, root)
                .Options);

        var query = new OperationsTaskQueryService(
            ops,
            new CourtVisitFeeChargeService(fin),
            new UserLabelLookup(identity),
            Options.Create(new DatabaseOptions()));
        return (query, ops);
    }
}
