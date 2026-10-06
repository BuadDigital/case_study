using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class PropertyOwnershipRulesTests
{
    [Fact]
    public void One_owner_is_absolute_and_several_owners_are_shared()
    {
        Assert.Equal(OwnershipTypes.Absolute, OwnershipTypeRules.FromOwners([new DeedOwner("أ")]));
        Assert.Equal(
            OwnershipTypes.Shared,
            OwnershipTypeRules.FromOwners([new DeedOwner("أ"), new DeedOwner("ب")]));
    }

    [Fact]
    public void No_owners_yet_counts_as_absolute_and_blank_names_are_not_owners()
    {
        Assert.Equal(OwnershipTypes.Absolute, OwnershipTypeRules.FromOwners([]));
        Assert.Equal(
            OwnershipTypes.Absolute,
            OwnershipTypeRules.FromOwners([new DeedOwner("أ"), new DeedOwner("  ")]));
    }

    [Fact]
    public void Owners_json_round_trip_drops_blank_names_and_ignores_legacy_shares()
    {
        var json = OwnershipTypeRules.SerializeOwners(
            [new DeedOwner(" محمد "), new DeedOwner(""), new DeedOwner("سعد")]);
        Assert.NotNull(json);
        var parsed = OwnershipTypeRules.ParseOwners(json);
        Assert.Equal(["محمد", "سعد"], parsed.Select(o => o.Name));
        Assert.Null(OwnershipTypeRules.SerializeOwners([new DeedOwner(" ")]));

        // A row saved before shares were removed still reads: the share is simply ignored.
        var legacy = OwnershipTypeRules.ParseOwners("""[{"name":"أ","sharePct":60},{"name":"ب","sharePct":40}]""");
        Assert.Equal(OwnershipTypes.Shared, OwnershipTypeRules.FromOwners(legacy));
        Assert.Empty(OwnershipTypeRules.ParseOwners("not json"));
    }

    [Fact]
    public void Only_absolute_and_shared_are_known_types()
    {
        Assert.True(OwnershipTypes.IsKnown("absolute"));
        Assert.True(OwnershipTypes.IsKnown("shared"));
        Assert.False(OwnershipTypes.IsKnown("mortgaged"));
        Assert.False(OwnershipTypes.IsKnown("investment"));
        Assert.Equal("مشاع", OwnershipTypes.LabelAr("shared"));
        Assert.Equal("", OwnershipTypes.LabelAr("mortgaged"));
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
 // no users / single / multiple.
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
