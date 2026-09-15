using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class StaffValuerRosterSyncRulesTests
{
    private static OrganizationValuerRosterEntryDto Row(
        string id,
        string name,
        string role = "valuer",
        bool active = true,
        string? staffUserId = null) =>
        new()
        {
            Id = id,
            NameAr = name,
            Role = role,
            IsActive = active,
            StaffUserId = staffUserId,
            MembershipNumber = "1210000001",
        };

    [Fact]
    public void Upsert_appends_a_working_valuer_when_no_row_matches()
    {
        var next = StaffValuerRosterSyncRules.Apply(
            [Row("c1", "عماد رشيد صالح الرشيد", "certified")],
            "u-new",
            "سعد المقيم",
            upsert: true);

        Assert.Equal(2, next.Count);
        var added = Assert.Single(next, v => v.StaffUserId == "u-new");
        Assert.Equal("سعد المقيم", added.NameAr);
        Assert.Equal(StaffValuerRosterSyncRules.WorkingValuerRole, added.Role);
        Assert.True(added.IsActive);
        Assert.Equal("certified", next[0].Role);
    }

    [Fact]
    public void Upsert_links_an_unmatched_row_by_name_and_keeps_professional_fields()
    {
        var existing = Row("v2", "سعد المقيم", "reviewer", staffUserId: null);
        var next = StaffValuerRosterSyncRules.Apply(
            [Row("c1", "عماد رشيد صالح الرشيد", "certified"), existing],
            "u-saad",
            "سعد  المقيم",
            upsert: true);

        Assert.Equal(2, next.Count);
        var linked = Assert.Single(next, v => v.Id == "v2");
        Assert.Equal("u-saad", linked.StaffUserId);
        Assert.Equal("سعد  المقيم", linked.NameAr);
        Assert.Equal("reviewer", linked.Role);
        Assert.Equal("1210000001", linked.MembershipNumber);
        Assert.True(linked.IsActive);
    }

    [Fact]
    public void Upsert_does_not_steal_a_row_already_linked_to_another_account()
    {
        var taken = Row("v2", "سعد المقيم", staffUserId: "u-other");
        var next = StaffValuerRosterSyncRules.Apply(
            [taken],
            "u-saad",
            "سعد المقيم",
            upsert: true);

        Assert.Equal(2, next.Count);
        Assert.Equal("u-other", next[0].StaffUserId);
        Assert.Equal("u-saad", next[1].StaffUserId);
    }

    [Fact]
    public void Upsert_does_not_touch_the_certified_row_even_by_name()
    {
        var certified = Row("c1", "عماد رشيد صالح الرشيد", "certified");
        var next = StaffValuerRosterSyncRules.Apply(
            [certified],
            "u-emad",
            "عماد رشيد صالح الرشيد",
            upsert: true);

        Assert.Equal(2, next.Count);
        Assert.Null(next[0].StaffUserId);
        Assert.Equal("certified", next[0].Role);
        Assert.Equal("u-emad", next[1].StaffUserId);
        Assert.Equal("valuer", next[1].Role);
    }

    [Fact]
    public void Upsert_does_not_mutate_a_certified_row_already_linked_by_staff_id()
    {
        var certified = Row("c1", "عماد", "certified", staffUserId: "u-emad");
        var next = StaffValuerRosterSyncRules.Apply(
            [certified],
            "u-emad",
            "عماد المحدّث",
            upsert: true);

        Assert.Single(next);
        Assert.Equal("عماد", next[0].NameAr);
        Assert.Equal("certified", next[0].Role);
        Assert.Equal("u-emad", next[0].StaffUserId);
    }

    [Fact]
    public void Deactivate_hides_the_linked_row_and_keeps_staffUserId()
    {
        var linked = Row("v2", "سعد المقيم", staffUserId: "u-saad");
        var next = StaffValuerRosterSyncRules.Apply(
            [linked],
            "u-saad",
            "سعد المقيم",
            upsert: false);

        var row = Assert.Single(next);
        Assert.False(row.IsActive);
        Assert.Equal("u-saad", row.StaffUserId);
        Assert.Equal("سعد المقيم", row.NameAr);
    }

    [Fact]
    public void Deactivate_is_a_noop_when_no_row_is_linked()
    {
        var roster = new[] { Row("v2", "سعد المقيم") };
        var next = StaffValuerRosterSyncRules.Apply(
            roster,
            "u-missing",
            "سعد المقيم",
            upsert: false);

        Assert.Single(next);
        Assert.True(next[0].IsActive);
        Assert.Null(next[0].StaffUserId);
    }

    [Fact]
    public void Reactivate_updates_name_on_the_linked_row()
    {
        var linked = Row("v2", "اسم قديم", active: false, staffUserId: "u-saad");
        var next = StaffValuerRosterSyncRules.Apply(
            [linked],
            "u-saad",
            "سعد المقيم",
            upsert: true);

        var row = Assert.Single(next);
        Assert.True(row.IsActive);
        Assert.Equal("سعد المقيم", row.NameAr);
        Assert.Equal("u-saad", row.StaffUserId);
    }
}
