using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.Application.Tests;

/// <summary>The finance notice for a handed-over deed: its text, its link and when it counts as a new notice.</summary>
public class EnfazHandoverNotificationRulesTests
{
    private static readonly Guid PropertyId = Guid.Parse("d1000000-0000-0000-0000-00000000000d");
    private static readonly DateTime HandedOver = new(2026, 11, 1, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void It_names_the_deed_and_the_order_and_opens_the_order_in_the_eligible_tab()
    {
        var notice = EnfazHandoverNotificationRules.Build(PropertyId, " PO-1 ", " 123 ", "RE-9", HandedOver);

        Assert.Equal("صك جديد مرفوع على إنفاذ", notice.Title);
        Assert.StartsWith("رُفع الصك 123 من أمر العمل PO-1 على إنفاذ.", notice.Body);
        Assert.Equal("/financial?area=revenue&stage=eligible&po=PO-1", notice.Href);
        Assert.Equal("financial", notice.Category);
        Assert.Equal("property", notice.EntityType);
        Assert.Equal(PropertyId.ToString("D"), notice.EntityId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_deed_without_a_number_uses_its_registration_number(string? deedNumber)
    {
        var notice = EnfazHandoverNotificationRules.Build(PropertyId, "PO-1", deedNumber, "RE-9", HandedOver);

        Assert.StartsWith("رُفع الصك RE-9 من أمر العمل", notice.Body);
    }

    [Fact]
    public void A_deed_with_no_number_at_all_is_called_a_deed()
    {
        var notice = EnfazHandoverNotificationRules.Build(PropertyId, "PO-1", "", null, HandedOver);

        Assert.StartsWith("رُفع صك من أمر العمل PO-1", notice.Body);
    }

    [Fact]
    public void Without_an_order_number_the_text_and_the_link_drop_it()
    {
        var notice = EnfazHandoverNotificationRules.Build(PropertyId, null, "123", null, HandedOver);

        Assert.StartsWith("رُفع الصك 123 على إنفاذ.", notice.Body);
        Assert.Equal("/financial?area=revenue&stage=eligible", notice.Href);
    }

    [Fact]
    public void The_order_number_is_escaped_in_the_link()
    {
        var notice = EnfazHandoverNotificationRules.Build(PropertyId, "PO 1&x", "123", null, HandedOver);

        Assert.Equal("/financial?area=revenue&stage=eligible&po=PO%201%26x", notice.Href);
    }

    [Fact]
    public void A_second_handover_of_the_same_deed_is_a_new_notice()
    {
        var first = EnfazHandoverNotificationRules.Build(PropertyId, "PO-1", "123", null, HandedOver);
        var again = EnfazHandoverNotificationRules.Build(PropertyId, "PO-1", "123", null, HandedOver.AddDays(3));

        Assert.NotEqual(first.SourceEvent, again.SourceEvent);
    }
}
