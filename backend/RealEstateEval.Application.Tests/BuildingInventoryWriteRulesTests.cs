using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class BuildingInventoryWriteRulesTests
{
    private static FieldInspectionWriteFacts Facts(string? assignee, string? status = null) => new(assignee, status);

    private static BuildingInventoryWriteAccess Resolve(
        string? role,
        string userId = "u-1",
        string? distributionId = null,
        params FieldInspectionWriteFacts[] tasks) =>
        BuildingInventoryWriteRules.Resolve(role, userId, distributionId, tasks);

    [Fact]
    public void The_assigned_inspector_writes_the_table_on_a_draft()
    {
        Assert.Equal(
            BuildingInventoryWriteAccess.Inspector,
            Resolve("field-inspector", "u-1", null, Facts("u-1", PartyTaskSubmissionStatus.Draft)));
        Assert.Equal(
            BuildingInventoryWriteAccess.Inspector,
            Resolve("field-inspector", "u-1", null, Facts("u-1")));
    }

    [Fact]
    public void The_inspector_is_matched_by_his_distribution_assignee_id_too()
    {
        Assert.Equal(
            BuildingInventoryWriteAccess.Inspector,
            Resolve("field-inspector", "u-9", "dist-4", Facts("dist-4")));
    }

    [Fact]
    public void Another_inspector_is_denied()
    {
        Assert.Equal(
            BuildingInventoryWriteAccess.Denied,
            Resolve("field-inspector", "u-2", null, Facts("u-1")));
    }

    [Fact]
    public void An_inspector_with_no_inspection_task_on_the_property_is_denied()
    {
        Assert.Equal(BuildingInventoryWriteAccess.Denied, Resolve("field-inspector", "u-1"));
    }

    [Fact]
    public void An_unassigned_task_gives_the_inspector_nothing()
    {
        Assert.Equal(
            BuildingInventoryWriteAccess.Denied,
            Resolve("field-inspector", "u-1", null, Facts(null)));
    }

    [Fact]
    public void A_submitted_package_closes_the_inspector_out()
    {
        Assert.Equal(
            BuildingInventoryWriteAccess.Denied,
            Resolve("field-inspector", "u-1", null, Facts("u-1", PartyTaskSubmissionStatus.Submitted)));
    }

    [Fact]
    public void A_reopened_package_opens_the_table_again()
    {
        Assert.Equal(
            BuildingInventoryWriteAccess.Inspector,
            Resolve("field-inspector", "u-1", null, Facts("u-1", PartyTaskSubmissionStatus.Reopened)));
    }

    [Fact]
    public void An_open_task_of_his_keeps_him_in_even_when_another_was_submitted()
    {
        Assert.Equal(
            BuildingInventoryWriteAccess.Inspector,
            Resolve(
                "field-inspector",
                "u-1",
                null,
                Facts("u-1", PartyTaskSubmissionStatus.Submitted),
                Facts("u-1", PartyTaskSubmissionStatus.Reopened)));
    }

    [Theory]
    [InlineData("engineering-office")]
    [InlineData("real-estate-appraiser")]
    [InlineData("finance")]
    [InlineData("")]
    [InlineData(null)]
    public void Other_roles_are_denied_even_when_named_as_the_assignee(string? role)
    {
        Assert.Equal(
            BuildingInventoryWriteAccess.Denied,
            Resolve(role, "u-1", null, Facts("u-1", PartyTaskSubmissionStatus.Draft)));
    }

    [Theory]
    [InlineData("case-specialist")]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("cdo")]
    public void Case_staff_always_write_with_or_without_a_task(string role)
    {
        Assert.Equal(BuildingInventoryWriteAccess.Staff, Resolve(role));
        Assert.Equal(
            BuildingInventoryWriteAccess.Staff,
            Resolve(role, "u-7", null, Facts("u-1", PartyTaskSubmissionStatus.Submitted)));
    }

    [Fact]
    public void Staff_set_is_exactly_the_party_submission_managers()
    {
        foreach (var role in new[] { "cdo", "case-specialist", "section-supervisor", "general-manager", "field-inspector", "finance" })
        {
            var expected = RealEstateEval.Application.Rules.PoRoleMatrixRules.CanManagePartySubmissions(role);
            Assert.Equal(expected, Resolve(role) == BuildingInventoryWriteAccess.Staff);
        }
    }

    [Fact]
    public void Only_the_assigned_inspector_reads_among_inspectors()
    {
        var tasks = new[] { Facts("u-1", PartyTaskSubmissionStatus.Submitted) };

        Assert.True(BuildingInventoryWriteRules.InspectorMayRead("field-inspector", "u-1", null, tasks));
        Assert.False(BuildingInventoryWriteRules.InspectorMayRead("field-inspector", "u-2", null, tasks));
        Assert.False(BuildingInventoryWriteRules.InspectorMayRead("field-inspector", "u-1", null, []));
        Assert.True(BuildingInventoryWriteRules.InspectorMayRead("case-specialist", "u-2", null, []));
        Assert.True(BuildingInventoryWriteRules.InspectorMayRead("engineering-office", "u-2", null, []));
    }
}
