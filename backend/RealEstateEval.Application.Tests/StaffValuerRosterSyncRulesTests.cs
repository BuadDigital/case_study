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
    public void Upsert_links_the_certified_row_only_on_its_exact_name()
    {
        var certified = Row("c1", "عماد رشيد صالح الرشيد", "certified");
        var exact = StaffValuerRosterSyncRules.Apply(
            [certified],
            "u-emad",
            "عماد رشيد صالح الرشيد",
            upsert: true);
        var linked = Assert.Single(exact);
        Assert.Equal("u-emad", linked.StaffUserId);
        Assert.Equal("certified", linked.Role);

        var partial = StaffValuerRosterSyncRules.Apply(
            [certified],
            "u-other",
            "عماد",
            upsert: true);
        Assert.Equal(2, partial.Count);
        Assert.Null(partial[0].StaffUserId);
        Assert.Equal("certified", partial[0].Role);
        Assert.Equal("valuer", partial[1].Role);
    }

    [Fact]
    public void Upsert_renames_a_linked_certified_row_but_never_changes_its_seat()
    {
        var certified = Row("c1", "عماد", "certified", staffUserId: "u-emad");
        var next = StaffValuerRosterSyncRules.Apply(
            [certified],
            "u-emad",
            "عماد المحدّث",
            upsert: true,
            new StaffValuerProfessional("none", null, null, null, null, null, null, null));

        var row = Assert.Single(next);
        Assert.Equal("عماد المحدّث", row.NameAr);
        Assert.Equal("certified", row.Role);
        Assert.True(row.IsActive);
        Assert.Equal("u-emad", row.StaffUserId);
    }

    [Fact]
    public void Upsert_applies_the_report_role_and_professional_fields()
    {
        var professional = new StaffValuerProfessional(
            "reviewer", "fellow", "1210009999", "2028-01-31", "4455", "2020-05-01", "2027-05-01", "data:sig");
        var next = StaffValuerRosterSyncRules.Apply(
            [],
            "u-saad",
            "سعد المقيم",
            upsert: true,
            professional);

        var row = Assert.Single(next);
        Assert.Equal("reviewer", row.Role);
        Assert.Equal("fellow", row.MembershipCategory);
        Assert.Equal("1210009999", row.MembershipNumber);
        Assert.Equal("2028-01-31", row.MembershipExpiresAt);
        Assert.Equal("4455", row.LicenseNumber);
        Assert.Equal("data:sig", row.SignatureUrl);

        var cleared = StaffValuerRosterSyncRules.Apply(
            next,
            "u-saad",
            "سعد المقيم",
            upsert: true,
            new StaffValuerProfessional(null, null, "", null, null, null, null, null));
        Assert.Null(Assert.Single(cleared).MembershipNumber);
        Assert.Equal("reviewer", cleared[0].Role);
    }

    [Fact]
    public void Upsert_claims_the_named_unlinked_row_even_when_the_names_differ()
    {
        var certified = Row("c1", "عماد رشيد صالح الرشيد", "certified");
        var link = new StaffValuerProfessional(null, null, null, null, null, null, null, null, "c1");
        var next = StaffValuerRosterSyncRules.Apply([certified], "u-emad", "عماد الرشيد", upsert: true, link);

        var row = Assert.Single(next);
        Assert.Equal("u-emad", row.StaffUserId);
        Assert.Equal("عماد الرشيد", row.NameAr);
        Assert.Equal("certified", row.Role);

        var taken = Row("v9", "سعد", staffUserId: "u-other");
        var kept = StaffValuerRosterSyncRules.Apply(
            [taken], "u-new", "سعد آخر", upsert: true,
            new StaffValuerProfessional("valuer", null, null, null, null, null, null, null, "v9"));
        Assert.Equal(2, kept.Count);
        Assert.Equal("u-other", kept[0].StaffUserId);
    }

    [Fact]
    public void Report_role_none_hides_the_row_and_adds_nothing_new()
    {
        var hide = new StaffValuerProfessional("none", null, null, null, null, null, null, null);
        var linked = Row("v2", "سعد المقيم", staffUserId: "u-saad");
        var hidden = StaffValuerRosterSyncRules.Apply([linked], "u-saad", "سعد المقيم", upsert: true, hide);
        Assert.False(Assert.Single(hidden).IsActive);

        var none = StaffValuerRosterSyncRules.Apply([], "u-new", "أخصائي", upsert: true, hide);
        Assert.Empty(none);
    }

    [Fact]
    public void Deactivate_hides_a_linked_certified_row_so_issuance_stops()
    {
        var certified = Row("c1", "عماد", "certified", staffUserId: "u-emad");
        var next = StaffValuerRosterSyncRules.Apply(
            [certified],
            "u-emad",
            "عماد",
            upsert: false);

        var row = Assert.Single(next);
        Assert.False(row.IsActive);
        Assert.Equal("certified", row.Role);
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
