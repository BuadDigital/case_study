using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class PropertyDocumentTypesTests
{
    [Fact]
    public void Keys_and_legacy_scopes_are_unique()
    {
        Assert.Equal(
            PropertyDocumentTypes.All.Count,
            PropertyDocumentTypes.All.Select(t => t.Key).Distinct(StringComparer.Ordinal).Count());
        var scopes = PropertyDocumentTypes.All.SelectMany(t => t.LegacyScopes).ToList();
        Assert.Equal(scopes.Count, scopes.Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public void Every_type_belongs_to_a_known_group()
    {
        Assert.All(PropertyDocumentTypes.All, t => Assert.Contains(t.Group, PropertyDocumentGroups.All));
    }

    [Fact]
    public void Bourse_deed_and_registry_count_as_the_deed_but_letters_do_not()
    {
        Assert.Equal("deed", PropertyDocumentTypes.Find("bourse-deed")!.RequirementKey);
        Assert.Equal("deed", PropertyDocumentTypes.Find("real-estate-registry")!.RequirementKey);
        Assert.Equal("delegation-letter", PropertyDocumentTypes.Find("delegation-letter")!.RequirementKey);
        Assert.Equal("assignment-letter", PropertyDocumentTypes.Find("assignment-letter")!.RequirementKey);
    }

    [Fact]
    public void Resolve_prefers_the_stored_type_over_the_scope()
    {
        var type = PropertyDocumentTypes.Resolve("lease-contract", "property-other", "PO-1:p");

        Assert.Equal("lease-contract", type!.Key);
        Assert.Equal("unlisted", PropertyDocumentTypes.Resolve(null, "property-other", "PO-1:p")!.Key);
        Assert.Null(PropertyDocumentTypes.Resolve(null, "key-envelope-photo", "env-1"));
    }

    [Fact]
    public void Built_aliases_expand_to_the_real_property_types()
    {
        var keys = PropertyDocumentTypes.NormalizePropertyTypeKeys(["الكل", " مبني ", "أرض", "فيلا"]);

        Assert.Equal(["فيلا", "شقة", "عمارة", "محل تجاري", "مستودع", "أرض"], keys);
    }

    [Fact]
    public void Photos_outputs_and_unlisted_are_not_admin_configurable()
    {
        var configurable = PropertyDocumentTypes.All.Where(t => t.IsConfigurable).Select(t => t.Key).ToList();

        Assert.Contains("deed", configurable);
        Assert.Contains("lease-contract", configurable);
        Assert.DoesNotContain("inspection-photo", configurable);
        Assert.DoesNotContain("valuation-report", configurable);
        Assert.DoesNotContain("unlisted", configurable);
    }
}
