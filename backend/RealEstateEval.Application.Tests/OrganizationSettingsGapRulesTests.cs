using RealEstateEval.Domain;
using RealEstateEval.Platform.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class OrganizationSettingsGapRulesTests
{
    private static AuditLog Save(string actor, string before, string after, int minute) => new()
    {
        Id = Guid.NewGuid(),
        ActorId = actor,
        Action = OrganizationSettingsGapRules.SavedAction,
        EntityType = OrganizationSettingsGapRules.AuditEntityType,
        EntityId = "settings",
        BeforeJson = before,
        AfterJson = after,
        CreatedAtUtc = new DateTime(2026, 9, 1, 8, minute, 0, DateTimeKind.Utc),
    };

    [Fact]
    public void Names_the_last_person_who_changed_each_section()
    {
        // Newest first, as the service reads them.
        var rows = new[]
        {
            Save(
                "u-sla",
                """{"company":{"name":"إجادة"},"sla":{"days":5}}""",
                """{"company":{"name":"إجادة"},"sla":{"days":7}}""",
                30),
            Save(
                "u-roster",
                """{"evaluator":{"name":"أ"},"valuers":[{"nameAr":"سالم"}]}""",
                """{"evaluator":{"name":"أ"},"valuers":[{"nameAr":"سالم","membershipNumber":"77"}]}""",
                20),
            Save(
                "system",
                """{"company":{"practiceLicenseNumber":""}}""",
                """{"company":{"practiceLicenseNumber":"1302"}}""",
                15),
            Save(
                "u-company",
                """{"company":{"practiceLicenseNumber":""}}""",
                """{"company":{"practiceLicenseNumber":"1400"}}""",
                10),
        };

        Assert.Equal("u-company", OrganizationSettingsGapRules.LastEditor(rows, "company")?.ActorId);
        Assert.Equal("u-roster", OrganizationSettingsGapRules.LastEditor(rows, "evaluator")?.ActorId);
        Assert.Null(OrganizationSettingsGapRules.LastEditor(rows, "report"));
    }

    [Fact]
    public void Unreadable_audit_json_changes_nothing()
    {
        var row = Save("u1", "not json", """{"company":{}}""", 1);
        Assert.False(OrganizationSettingsGapRules.ChangedSection(row, "company"));
    }

    [Theory]
    [InlineData("Company", "company")]
    [InlineData(" report ", "report")]
    [InlineData("branding", null)]
    public void Normalizes_the_settings_tabs_the_report_reads(string raw, string? expected)
    {
        Assert.Equal(expected, OrganizationSettingsGapRules.NormalizeSection(raw));
    }
}
