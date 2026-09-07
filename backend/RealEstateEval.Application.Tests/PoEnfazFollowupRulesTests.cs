using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>Follow-up and aging-bucket rules behind PoEnfazBillingService.</summary>
public class PoEnfazFollowupRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 2, 8, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(0, "0_30")]
    [InlineData(30, "0_30")]
    [InlineData(31, "31_60")]
    [InlineData(60, "31_60")]
    [InlineData(61, "61_90")]
    [InlineData(90, "61_90")]
    [InlineData(91, "90_plus")]
    public void Aging_bucket_edges_are_inclusive(int ageDays, string expectedKey)
    {
        Assert.Equal(expectedKey, PoEnfazFollowupRules.ResolveAgingBucket(ageDays).Key);
    }

    [Fact]
    public void Aging_bucket_labels_are_arabic()
    {
        Assert.Equal("0–30 يوماً", PoEnfazFollowupRules.ResolveAgingBucket(3).Label);
        Assert.Equal("أكثر من 90 يوماً", PoEnfazFollowupRules.ResolveAgingBucket(200).Label);
    }

    [Fact]
    public void Channel_is_normalised_and_unknown_means_a_call()
    {
        Assert.Equal(PoEnfazFollowupChannel.Email, PoEnfazFollowupRules.NormalizeChannel(" EMAIL "));
        Assert.Equal(PoEnfazFollowupChannel.Call, PoEnfazFollowupRules.NormalizeChannel("fax"));
        Assert.Equal(PoEnfazFollowupChannel.Call, PoEnfazFollowupRules.NormalizeChannel(null));
        Assert.Equal("بوابة إنفاذ", PoEnfazFollowupRules.ChannelLabel(PoEnfazFollowupChannel.Portal));
        Assert.Equal("اتصال", PoEnfazFollowupRules.ChannelLabel("anything"));
    }

    [Fact]
    public void A_followup_needs_a_po_and_a_note()
    {
        Assert.Equal("رقم أمر العمل مطلوب.", PoEnfazFollowupRules.ValidateFollowupInput("", "note"));
        Assert.Equal("ملاحظات المتابعة إلزامية.", PoEnfazFollowupRules.ValidateFollowupInput("PO-1", ""));
        Assert.Null(PoEnfazFollowupRules.ValidateFollowupInput("PO-1", "note"));
    }

    [Fact]
    public void Followup_row_caps_notes_and_dates_itself_now_by_default()
    {
        var longNotes = new string('x', 2500);
        var entity = PoEnfazFollowupRules.BuildFollowup(
            "PO-1",
            longNotes,
            new AddEnfazFollowupRequest { Channel = "visit" },
            "u-1",
            Now);

        Assert.Equal("PO-1", entity.PoNumber);
        Assert.Equal(2000, entity.Notes.Length);
        Assert.Equal(PoEnfazFollowupChannel.Visit, entity.Channel);
        Assert.Equal(Now, entity.FollowedAtUtc);
        Assert.Equal(Now, entity.CreatedAtUtc);
        Assert.Equal("u-1", entity.CreatedByUserId);
        Assert.NotEqual(Guid.Empty, entity.Id);
    }

    [Fact]
    public void Followup_row_keeps_the_caller_date_in_utc()
    {
        var followedAt = new DateTime(2026, 2, 1, 10, 0, 0, DateTimeKind.Utc);
        var entity = PoEnfazFollowupRules.BuildFollowup(
            "PO-1",
            "called",
            new AddEnfazFollowupRequest { FollowedAtUtc = followedAt },
            "u-1",
            Now);

        Assert.Equal(followedAt, entity.FollowedAtUtc);
        Assert.Equal("called", entity.Notes);
        Assert.Equal(PoEnfazFollowupChannel.Call, entity.Channel);
        Assert.Equal("اتصال", PoEnfazFollowupRules.ToFollowupDto(entity).ChannelLabel);
    }
}
