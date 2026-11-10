using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class PropertyOwnershipRulesTests
{
    [Fact]
    public void The_staff_tick_decides_shared_whatever_the_owners_count()
    {
        Assert.Equal(OwnershipTypes.Shared, OwnershipTypeRules.FromSharedFlag(true));
        Assert.Equal(OwnershipTypes.Absolute, OwnershipTypeRules.FromSharedFlag(false));

        // Two owners without the tick stay «ملكية تامة» (Omar 2026-11-10); one owner with it is «مشاع».
        var twoOwners = new WorkOrderProperty
        {
            Id = Guid.NewGuid(),
            DeedOwnersJson = OwnershipTypeRules.SerializeOwners([new DeedOwner("أ"), new DeedOwner("ب")]),
        };
        Assert.Equal(OwnershipTypes.Absolute, WorkOrderMapper.ToPropertyDto(twoOwners).OwnershipType);
        var ticked = new WorkOrderProperty { Id = Guid.NewGuid(), OwnerName = "أ", IsSharedOwnership = true };
        Assert.Equal(OwnershipTypes.Shared, WorkOrderMapper.ToPropertyDto(ticked).OwnershipType);
        Assert.True(WorkOrderMapper.ToPropertyDto(ticked).IsSharedOwnership);
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
        Assert.Equal(["أ", "ب"], legacy.Select(o => o.Name));
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
