using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationBoundaryTypeLabelsTests
{
    [Fact]
    public void Resolve_uses_catalog_name_when_key_matches()
    {
        var catalog = new ValuationListsDto
        {
            Lists = new Dictionary<string, List<ValuationListItemDto>>
            {
                [ValuationListIds.BoundaryTypes] =
                [
                    new ValuationListItemDto
                    {
                        Id = "boundaryTypes-open_space",
                        Key = "open_space",
                        Name = "فضاء",
                        IsEnabled = true,
                    },
                ],
            },
        };

        Assert.Equal("فضاء", ValuationBoundaryTypeLabels.Resolve(catalog, "open_space"));
    }

    [Fact]
    public void Resolve_falls_back_to_builtin_label_for_known_keys()
    {
        Assert.Equal("شارع", ValuationBoundaryTypeLabels.Resolve(null, "street"));
        Assert.Equal("ممر", ValuationBoundaryTypeLabels.Resolve(null, PropertyBoundaryTypes.Passage));
    }

    [Fact]
    public void Resolve_returns_raw_key_for_unknown_without_catalog()
    {
        Assert.Equal("custom_key", ValuationBoundaryTypeLabels.Resolve(null, "custom_key"));
    }

    [Fact]
    public void CountStreets_still_counts_street_key_only()
    {
        Assert.Equal(
            2,
            PropertyBoundaryTypes.CountStreets(
                PropertyBoundaryTypes.Street,
                "open_space",
                PropertyBoundaryTypes.Street,
                PropertyBoundaryTypes.Rail));
    }
}
