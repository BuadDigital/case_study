using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class PropertyOwnershipRulesTests
{
    [Fact]
    public void Mortgage_restriction_wins_over_shares()
    {
 // order: قيد رهن ⟵ مرهون before حصص ⟵ مشاع.
        var owners = new[] { new DeedOwner("أ", 50m), new DeedOwner("ب", 50m) };
        Assert.Equal(OwnershipTypes.Mortgaged, OwnershipTypeRules.Suggest(owners, "mortgaged,other"));
    }

    [Fact]
    public void Multiple_owners_or_partial_share_suggest_shared()
    {
        Assert.Equal(
            OwnershipTypes.Shared,
            OwnershipTypeRules.Suggest([new DeedOwner("أ", 50m), new DeedOwner("ب", 50m)], null));
        Assert.Equal(
            OwnershipTypes.Shared,
            OwnershipTypeRules.Suggest([new DeedOwner("أ", 60m)], null));
    }

    [Fact]
    public void Single_owner_no_restrictions_suggests_absolute()
    {
        Assert.Equal(
            OwnershipTypes.Absolute,
            OwnershipTypeRules.Suggest([new DeedOwner("أ", null)], "seized"));
        Assert.Equal(OwnershipTypes.Absolute, OwnershipTypeRules.Suggest([], null));
    }

    [Fact]
    public void Investment_is_manual_only_via_effective()
    {
        var owners = new[] { new DeedOwner("أ", (decimal?)null) };
        Assert.Equal(
            OwnershipTypes.Investment,
            OwnershipTypeRules.Effective(true, "investment", owners, null));
 // Not manual → derived wins even if a stale manual value remains.
        Assert.Equal(
            OwnershipTypes.Absolute,
            OwnershipTypeRules.Effective(false, "investment", owners, null));
    }

    [Fact]
    public void Owners_json_round_trip_and_validation()
    {
        var json = OwnershipTypeRules.SerializeOwners(
            [new DeedOwner("محمد", 66.67m), new DeedOwner("سعد", 33.33m)]);
        Assert.NotNull(json);
        var parsed = OwnershipTypeRules.ParseOwners(json);
        Assert.Equal(2, parsed.Count);
        Assert.Equal("محمد", parsed[0].Name);
        Assert.Null(OwnershipTypeRules.ValidateOwners(parsed));

        Assert.NotNull(OwnershipTypeRules.ValidateOwners([new DeedOwner("", 50m)]));
        Assert.NotNull(OwnershipTypeRules.ValidateOwners([new DeedOwner("أ", 120m)]));
        Assert.NotNull(OwnershipTypeRules.ValidateOwners(
            [new DeedOwner("أ", 70m), new DeedOwner("ب", 40m)]));
        Assert.Empty(OwnershipTypeRules.ParseOwners("not json"));
    }
}

public class WorkOrderReportUsersTests
{
    [Fact]
    public void Serialize_dedupes_and_drops_empty()
    {
        var id = Guid.NewGuid();
        var json = WorkOrderReportUsers.Serialize([id, id, Guid.Empty]);
        Assert.NotNull(json);
        var parsed = WorkOrderReportUsers.Parse(json);
        Assert.Single(parsed);
        Assert.Equal(id, parsed[0]);

        Assert.Null(WorkOrderReportUsers.Serialize([]));
        Assert.Null(WorkOrderReportUsers.Serialize(null));
        Assert.Empty(WorkOrderReportUsers.Parse("bad json"));
    }

    [Fact]
    public void Usage_restriction_sentence_three_cases()
    {
 // لا مستخدمين / واحد / متعدد.
        var none = ValuationReportNarrativeRules.UsageRestrictionSentence("إنفاذ", []);
        Assert.Contains("وحده", none);
        Assert.Contains("إنفاذ", none);

        var one = ValuationReportNarrativeRules.UsageRestrictionSentence("إنفاذ", ["بنك أ"]);
        Assert.Contains("مستخدم التقرير", one);
        Assert.Contains("بنك أ", one);

        var many = ValuationReportNarrativeRules.UsageRestrictionSentence(
            "إنفاذ", ["بنك أ", "بنك ب"]);
        Assert.Contains("مستخدمي التقرير", many);
        Assert.Contains("بنك ب", many);
    }
}
