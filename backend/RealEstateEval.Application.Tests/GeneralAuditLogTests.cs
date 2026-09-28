using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Platform.Infrastructure.Services;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Application.Tests;

public class GeneralAuditLogTests
{
    [Fact]
    public void Writer_builds_separate_before_and_after_documents()
    {
        var writer = new AuditLogWriter();

        var row = writer.CreateFromChanges(
            " actor-1 ",
            "ENTITY_UPDATED",
            "entity",
            "entity-1",
            new Dictionary<string, AuditValueChange>
            {
                ["name"] = new("before", "after"),
                ["enabled"] = new(false, true),
            });

        Assert.Equal("actor-1", row.ActorId);
        using var before = JsonDocument.Parse(row.BeforeJson);
        using var after = JsonDocument.Parse(row.AfterJson);
        Assert.Equal("before", before.RootElement.GetProperty("name").GetString());
        Assert.Equal("after", after.RootElement.GetProperty("name").GetString());
        Assert.False(before.RootElement.GetProperty("enabled").GetBoolean());
        Assert.True(after.RootElement.GetProperty("enabled").GetBoolean());
    }

    [Fact]
    public async Task Field_dictionary_save_writes_actor_and_snapshots_atomically()
    {
        await using var db = TestDatabases.Platform("field-dictionary-audit");
        var service = new FieldDictionaryService(db, new AuditLogWriter());

        await service.SaveAsync(
            new SaveFieldDictionaryStateRequest { Tags = ["legal"] },
            "admin-1");

        var audit = Assert.Single(db.AuditLogs);
        Assert.Equal("admin-1", audit.ActorId);
        Assert.Equal("FIELD_DICTIONARY_SAVED", audit.Action);
        Assert.Equal("field_dictionary", audit.EntityType);
        Assert.Equal("null", audit.BeforeJson);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal("legal", after.RootElement.GetProperty("tags")[0].GetString());
    }

    [Fact]
    public async Task Case_study_role_save_records_sanitized_configuration()
    {
        await using var db = TestDatabases.Platform("case-study-role-audit");
        var service = new CaseStudyInfoRolesConfigService(db, new AuditLogWriter());

        await service.SaveAsync(
            new SaveCaseStudyInfoRolesRequest
            {
                Matrix = new()
                {
                    ["ownerName"] = new()
                    {
                        ["specA"] = "primary",
                        ["invalid-party"] = "primary",
                    },
                },
                Notes = new() { ["ownerName"] = "Required source" },
            },
            "admin-2");

        var audit = Assert.Single(db.AuditLogs);
        Assert.Equal("CASE_STUDY_INFO_ROLES_SAVED", audit.Action);
        using var after = JsonDocument.Parse(audit.AfterJson);
        var matrix = after.RootElement.GetProperty("matrix").GetProperty("ownerName");
        Assert.Equal("primary", matrix.GetProperty("specA").GetString());
        Assert.False(matrix.TryGetProperty("invalid-party", out _));
    }

    [Fact]
    public async Task Query_filters_and_pages_without_exposing_mutation()
    {
        await using var db = TestDatabases.Platform("audit-query");
        var writer = new AuditLogWriter();
        db.AuditLogs.AddRange(
            writer.Create("actor-1", "CREATED", "court", "1", null, new { name = "one" }),
            writer.Create("actor-2", "UPDATED", "court", "1", new { name = "one" }, new { name = "two" }),
            writer.Create("actor-1", "CREATED", "user", "2", null, new { name = "user" }));
        await db.SaveChangesAsync();
        var service = new AuditLogQueryService(db);

        var result = await service.ListAsync(
            entityType: "court",
            entityId: "1",
            action: null,
            actorId: null,
            page: 1,
            limit: 1);

        Assert.Equal(2, result.Total);
        Assert.Single(result.Items);
        Assert.Equal("court", result.Items[0].EntityType);
        Assert.Equal("1", result.Items[0].EntityId);
    }

    [Fact]
    public async Task Query_resolves_actor_display_names_for_every_user_id()
    {
        await using var db = TestDatabases.Platform("audit-query-names");
        var writer = new AuditLogWriter();
        db.AuditLogs.Add(
            writer.Create("user-aaa", "CREATED", "court", "1", null, new { name = "one" }));
        await db.SaveChangesAsync();

        var directory = new StubIdentityDirectory(new Dictionary<string, string>
        {
            ["user-aaa"] = "أحمد سعيد",
        });
        var service = new AuditLogQueryService(db, directory);

        var result = await service.ListAsync(null, null, null, null, 1, 10);

        Assert.Equal("أحمد سعيد", Assert.Single(result.Items).ActorDisplayName);
    }

    private sealed class StubIdentityDirectory(IReadOnlyDictionary<string, string> names)
        : RealEstateEval.Application.Abstractions.IIdentityDirectory
    {
        public Task<string> ResolveAsync(string? raw, CancellationToken cancellationToken = default) =>
            Task.FromResult(names.TryGetValue(raw ?? "", out var n) ? n : raw ?? "");

        public Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
            IEnumerable<string?> raws,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(names);

        public Task<RealEstateEval.Application.Contracts.IdentityCompensationProfileDto?> GetCompensationByAssigneeAsync(
            string assigneeId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<RealEstateEval.Application.Contracts.IdentityCompensationProfileDto?>(null);

        public Task<string?> ResolveUserIdForDistributionAssigneeAsync(
            string distributionAssigneeId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<string?>(null);

        public Task<string?> ResolveUserIdForEmailAsync(
            string email,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<string?>(null);

        public Task<IReadOnlyDictionary<string, string>> ResolveUserIdsForDistributionAssigneesAsync(
            IReadOnlyCollection<string> distributionAssigneeIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(
                new Dictionary<string, string>());

        public Task<IReadOnlyList<string>> ResolveUserIdsWithPrototypeRoleAsync(
            string prototypeRole,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<string>>([]);

        public Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesByUserIdsAsync(
            IReadOnlyCollection<string> userIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(names);

        public Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesByAssigneeIdsAsync(
            IReadOnlyCollection<string> assigneeIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(
                new Dictionary<string, string>());
    }
}
