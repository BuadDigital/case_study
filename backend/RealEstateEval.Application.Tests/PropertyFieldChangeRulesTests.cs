using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Ruling 2026-11-02: every save of property data leaves a field change log — only the fields an
/// editor changed, never the stamps and derived members that move with them.
/// </summary>
public sealed class PropertyFieldChangeRulesTests
{
    private static WorkOrderPropertyDto Property() => new()
    {
        Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
        DeedNumber = "D-1",
        City = "الرياض",
        District = "العليا",
        Classification = "سكني",
        PropertyType = "أرض",
        PlanNumber = "12",
        UpdatedAtUtc = "2026-11-01T00:00:00Z",
    };

    [Fact]
    public void Only_the_edited_fields_are_logged()
    {
        var before = Property();
        var after = Property();
        after.PlanNumber = "13";
        after.Area = "500";
        after.UpdatedAtUtc = "2026-11-03T00:00:00Z";
        after.EffectivePropertyType = "فيلا";

        var changes = PropertyFieldChangeRules.Diff(before, after);

        Assert.Equal(new[] { "area", "planNumber" }, changes.Keys.Order());
        Assert.Equal("12", changes["planNumber"].Before);
        Assert.Equal("13", changes["planNumber"].After);
        Assert.Null(changes["area"].Before);
    }

    [Fact]
    public void An_identical_save_or_an_emptied_blank_logs_nothing()
    {
        var before = Property();
        var after = Property();
        before.PlotNumber = null;
        after.PlotNumber = "  ";

        Assert.Empty(PropertyFieldChangeRules.Diff(before, after));
    }

    [Fact]
    public void A_changed_list_is_one_change()
    {
        var before = Property();
        var after = Property();
        after.Owners = [new DeedOwnerDto { Name = "مالك" }];

        var changes = PropertyFieldChangeRules.Diff(before, after);

        Assert.Equal("owners", Assert.Single(changes).Key);
    }
}
