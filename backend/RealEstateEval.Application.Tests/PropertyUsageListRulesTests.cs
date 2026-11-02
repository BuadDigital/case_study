using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Platform.Application.Rules;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// «استخدام العقار» follows the unregistered-cities principle: the inspector's new name is usable at
/// once, repeats count on one row, and a reviewer approves or corrects it.
/// </summary>
public sealed class PropertyUsageListRulesTests
{
    private static ValuationListItemDto Row(string key, string name, string status = "approved", int usage = 0) =>
        new()
        {
            Id = $"propertyUsages-{key}",
            Key = key,
            Name = name,
            Status = status,
            Usage = usage,
            SortOrder = 1,
        };

    [Fact]
    public void A_new_name_joins_the_list_as_pending()
    {
        var rows = PropertyUsageListRules.Record([Row("residential", "سكني")], "مغسلة سيارات", () => "item-1")!;

        var added = rows[^1];
        Assert.Equal(2, rows.Count);
        Assert.Equal("مغسلة سيارات", added.Name);
        Assert.Equal(ValuationListItemStatuses.Pending, added.Status);
        Assert.Equal("مغسلة سيارات", added.RawInput);
        Assert.Equal(1, added.Usage);
        Assert.True(added.IsEnabled);
    }

    [Theory]
    [InlineData("مغسله سيارات")]
    [InlineData(" مغسلة  سيارات ")]
    public void A_repeated_name_counts_on_one_row(string typed)
    {
        var rows = PropertyUsageListRules.Record(
            [Row("wash", "مغسلة سيارات", "pending", 3)], typed, () => "item-1")!;

        Assert.Equal(4, Assert.Single(rows).Usage);
        Assert.Equal("مغسلة سيارات", rows[0].Name);
    }

    [Fact]
    public void A_listed_name_is_counted_and_stays_approved()
    {
        var rows = PropertyUsageListRules.Record([Row("residential", "سكني")], "سكني", () => "item-1")!;

        Assert.Equal(1, rows[0].Usage);
        Assert.Equal(ValuationListItemStatuses.Approved, rows[0].Status);
    }

    [Theory]
    [InlineData("مبنى مفرد")]
    [InlineData("وحدة داخل مبنى")]
    [InlineData("")]
    [InlineData("Shop")]
    public void A_classification_or_an_unusable_name_never_joins_the_list(string typed)
    {
        Assert.Null(PropertyUsageListRules.Record([Row("residential", "سكني")], typed, () => "item-1"));
    }

    [Fact]
    public void Approving_keeps_the_name()
    {
        var rows = PropertyUsageListRules.Review([Row("wash", "مغسلة سيارات", "pending")], "wash", "approve", null);

        Assert.Equal(ValuationListItemStatuses.Approved, rows[0].Status);
        Assert.Equal("مغسلة سيارات", rows[0].Name);
    }

    [Fact]
    public void Correcting_approves_under_the_new_name()
    {
        var pending = new ValuationListItemDto
        {
            Id = "propertyUsages-wash",
            Key = "wash",
            Name = "مغسله",
            RawInput = "مغسله",
            Status = ValuationListItemStatuses.Pending,
        };

        var rows = PropertyUsageListRules.Review([pending], "wash", "rename", "مغسلة سيارات");

        Assert.Equal("مغسلة سيارات", rows[0].Name);
        Assert.Equal("مغسله", rows[0].RawInput);
        Assert.Equal(ValuationListItemStatuses.Approved, rows[0].Status);
    }

    [Fact]
    public void The_admin_may_correct_an_approved_name_later()
    {
        var rows = PropertyUsageListRules.Review([Row("office", "إداري")], "office", "rename", "مكاتب إدارية");

        Assert.Equal("مكاتب إدارية", rows[0].Name);
    }

    [Fact]
    public void A_correction_cannot_repeat_a_listed_name()
    {
        var error = Assert.Throws<InvalidOperationException>(() => PropertyUsageListRules.Review(
            [Row("residential", "سكني"), Row("wash", "مغسلة", "pending")], "wash", "rename", "سكني"));

        Assert.Equal("هذا الاستخدام موجود في القائمة.", error.Message);
    }

    [Fact]
    public void An_unknown_row_or_action_is_refused()
    {
        Assert.Throws<InvalidOperationException>(() => PropertyUsageListRules.Review([], "nope", "approve", null));
        Assert.Throws<InvalidOperationException>(() =>
            PropertyUsageListRules.Review([Row("residential", "سكني")], "residential", "merge", null));
    }

    [Theory]
    [InlineData("""{"featureValues":{"propertyUsage":" سكني تجاري "}}""", "سكني تجاري")]
    [InlineData("""{"featureValues":{"propertyUsage":"مغسلة سيارات"}}""", "مغسلة سيارات")]
    [InlineData("""{"featureValues":{"propertyUsage":"مبنى مفرد"}}""", null)]
    [InlineData("""{"featureValues":{"propertyUsage":""}}""", null)]
    [InlineData("""{"featureValues":{}}""", null)]
    [InlineData("not json", null)]
    public void The_property_keeps_the_use_the_inspection_states(string payload, string? expected)
    {
        Assert.Equal(expected, InspectedUsageRules.FromPayload(payload));
    }
}
