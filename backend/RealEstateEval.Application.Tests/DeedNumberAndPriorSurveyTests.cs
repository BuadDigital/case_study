using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class DeedNumberRulesTests
{
    [Theory]
    [InlineData("123-456", "123456")]
    [InlineData("١٢٣ ٤٥٦", "123456")]
    [InlineData("  72/01  ", "7201")]
    public void Normalize_strips_separators_and_maps_arabic_digits(string raw, string expected)
    {
        Assert.Equal(expected, DeedNumberRules.Normalize(raw));
    }

    [Fact]
    public void EqualsNormalized_matches_arabic_and_latin()
    {
        Assert.True(DeedNumberRules.EqualsNormalized("١٢٣", "123"));
        Assert.False(DeedNumberRules.EqualsNormalized("123", "124"));
    }
}

public class PropertyListRowBuilderPriorSurveyTests
{
    [Fact]
    public void PriorSurveyWaived_is_false_when_deed_only_exists_on_current_po()
    {
        var deed = "DEED-ONLY-ONCE";
        var order = new WorkOrder
        {
            PoNumber = "PO-A",
            Properties =
            [
                new WorkOrderProperty
                {
                    Id = Guid.NewGuid(),
                    DeedNumber = deed,
                    Classification = "أرض",
                    BourseDataCompleted = true,
                },
            ],
        };

        var rows = PropertyListRowBuilder.Build([order], new HashSet<string>());
        Assert.Single(rows);
        Assert.Equal("new", rows[0].Row.Survey);
    }

    [Fact]
    public void PriorSurveyWaived_is_true_when_same_deed_exists_on_other_po()
    {
        var deed = "DEED-SHARED";
        var prior = new WorkOrder
        {
            PoNumber = "PO-OLD",
            CreatedAtUtc = DateTime.UtcNow.AddDays(-30),
            Properties =
            [
                new WorkOrderProperty
                {
                    Id = Guid.NewGuid(),
                    DeedNumber = deed,
                    Classification = "أرض",
                    BourseDataCompleted = true,
                },
            ],
        };
        var current = new WorkOrder
        {
            PoNumber = "PO-NEW",
            CreatedAtUtc = DateTime.UtcNow,
            Properties =
            [
                new WorkOrderProperty
                {
                    Id = Guid.NewGuid(),
                    DeedNumber = deed,
                    Classification = "أرض",
                    BourseDataCompleted = true,
                },
            ],
        };

        var rows = PropertyListRowBuilder.Build([prior, current], new HashSet<string>());
        var newRow = rows.Single(r => r.PoNumber == "PO-NEW");
        Assert.Equal("done", newRow.Row.Survey);
    }

    [Fact]
    public void Unit_inside_building_survey_is_done_without_prior()
    {
        var order = new WorkOrder
        {
            PoNumber = "PO-U",
            Properties =
            [
                new WorkOrderProperty
                {
                    Id = Guid.NewGuid(),
                    DeedNumber = "DEED-UNIT",
                    Classification = "وحدة داخل مبنى",
                    BourseDataCompleted = true,
                },
            ],
        };
        var rows = PropertyListRowBuilder.Build([order], new HashSet<string>());
        Assert.Equal("done", rows[0].Row.Survey);
    }

    [Fact]
    public void Registered_title_survey_is_done_without_prior()
    {
        var order = new WorkOrder
        {
            PoNumber = "PO-REG",
            Properties =
            [
                new WorkOrderProperty
                {
                    Id = Guid.NewGuid(),
                    DeedNumber = "310112006650",
                    Classification = "أرض",
                    IdentifierType = PropertyIdentifierType.RealEstateRegistration,
                    BourseDataCompleted = true,
                },
            ],
        };
        var rows = PropertyListRowBuilder.Build([order], new HashSet<string>());
        Assert.Equal("done", rows[0].Row.Survey);
    }
}
