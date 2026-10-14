using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Platform.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The government reviewer ("gov") left the form role matrix: it is dropped on save and on
/// read (no migration), and question 4 (deed_3) falls to the specialist when it would
/// otherwise have no party.
/// </summary>
public class CaseStudyInfoRolesConfigServiceTests
{
    private static readonly Guid RowId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    [Fact]
    public async Task Save_drops_government_and_gives_question_4_to_the_specialist()
    {
        await using var db = TestDatabases.Platform("case-study-roles-save-gov");
        var service = new CaseStudyInfoRolesConfigService(db, new AuditLogWriter());

        var saved = await service.SaveAsync(
            new SaveCaseStudyInfoRolesRequest
            {
                Matrix = new()
                {
                    ["deed_0"] = new() { ["specA"] = "verify" },
                    ["deed_3"] = new() { ["gov"] = "verify" },
                    ["deed_5"] = new()
                    {
                        ["specA"] = "verify",
                        ["gov"] = "secondary",
                        ["sup"] = "verify",
                    },
                },
            },
            "admin-1");

        Assert.Equal(new Dictionary<string, string> { ["specA"] = "primary" }, saved.Matrix["deed_3"]);
        Assert.Equal(
            new Dictionary<string, string> { ["specA"] = "verify", ["sup"] = "verify" },
            saved.Matrix["deed_5"]);
        Assert.DoesNotContain(saved.Matrix.Values, row => row.ContainsKey("gov"));
    }

    [Fact]
    public async Task Save_keeps_a_question_4_row_that_still_has_a_party()
    {
        await using var db = TestDatabases.Platform("case-study-roles-save-q4-kept");
        var service = new CaseStudyInfoRolesConfigService(db, new AuditLogWriter());

        var saved = await service.SaveAsync(
            new SaveCaseStudyInfoRolesRequest
            {
                Matrix = new()
                {
                    ["deed_3"] = new() { ["gov"] = "verify", ["insp"] = "secondary" },
                },
            },
            "admin-1");

        Assert.Equal(new Dictionary<string, string> { ["insp"] = "secondary" }, saved.Matrix["deed_3"]);
    }

    [Fact]
    public async Task Read_normalises_a_stored_matrix_that_still_carries_government()
    {
        await using var db = TestDatabases.Platform("case-study-roles-read-gov");
        db.CaseStudyInfoRolesConfigs.Add(new CaseStudyInfoRolesConfig
        {
            Id = RowId,
            MatrixJson =
                """{"deed_0":{"specA":"verify"},"deed_3":{"gov":"verify"},"deed_4":{"specA":"primary","gov":"secondary"}}""",
            NotesJson = "{}",
            UpdatedAtUtc = new DateTime(2026, 6, 28, 0, 0, 0, DateTimeKind.Utc),
        });
        await db.SaveChangesAsync();
        var service = new CaseStudyInfoRolesConfigService(db, new AuditLogWriter());

        var first = await service.GetAsync();
        var second = await service.GetAsync();

        Assert.Equal(new Dictionary<string, string> { ["specA"] = "primary" }, first.Matrix["deed_3"]);
        Assert.Equal(new Dictionary<string, string> { ["specA"] = "primary" }, first.Matrix["deed_4"]);
        Assert.DoesNotContain(first.Matrix.Values, row => row.ContainsKey("gov"));
        // Idempotent.
        Assert.Equal(first.Matrix.Count, second.Matrix.Count);
        Assert.Equal(first.Matrix["deed_3"], second.Matrix["deed_3"]);
    }

    [Fact]
    public void An_unconfigured_matrix_is_left_empty_so_the_frontend_still_seeds_its_defaults()
    {
        var empty = CaseStudyInfoRolesConfigService.NormalizeMatrix(new());
        var onlyGovernment = CaseStudyInfoRolesConfigService.NormalizeMatrix(new()
        {
            ["deed_3"] = new() { ["gov"] = "verify" },
        });

        Assert.Empty(empty);
        Assert.Empty(onlyGovernment["deed_3"]);
    }

    [Fact]
    public void Normalisation_is_idempotent()
    {
        var once = CaseStudyInfoRolesConfigService.NormalizeMatrix(new()
        {
            ["deed_0"] = new() { ["specA"] = "verify", ["gov"] = "secondary" },
        });
        var twice = CaseStudyInfoRolesConfigService.NormalizeMatrix(
            once.ToDictionary(
                kv => kv.Key,
                kv => kv.Value.ToDictionary(p => p.Key, p => (string?)p.Value)));

        Assert.Equal(once.Count, twice.Count);
        Assert.Equal(once["deed_3"], twice["deed_3"]);
        Assert.Equal(once["deed_0"], twice["deed_0"]);
    }
}
