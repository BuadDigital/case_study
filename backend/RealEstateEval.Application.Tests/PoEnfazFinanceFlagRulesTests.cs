using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>Finance flag input rules behind PoEnfazBillingService.</summary>
public class PoEnfazFinanceFlagRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 2, 8, 0, 0, DateTimeKind.Utc);

    private static PoEnfazFinanceFlag Flag(Guid? propertyId, string flag = PoEnfazFinanceFlagKind.Stopped) => new()
    {
        Id = Guid.NewGuid(),
        PoNumber = "PO-1",
        PropertyId = propertyId,
        Flag = flag,
    };

    [Fact]
    public void Only_the_three_known_flags_are_accepted()
    {
        Assert.Equal(PoEnfazFinanceFlagKind.Stopped, PoEnfazFinanceFlagRules.NormalizeFlag(" Stopped "));
        Assert.Equal(PoEnfazFinanceFlagKind.Excluded, PoEnfazFinanceFlagRules.NormalizeFlag("EXCLUDED"));
        Assert.Equal(PoEnfazFinanceFlagKind.Difficult, PoEnfazFinanceFlagRules.NormalizeFlag("difficult"));
        Assert.Null(PoEnfazFinanceFlagRules.NormalizeFlag("paused"));
        Assert.Null(PoEnfazFinanceFlagRules.NormalizeFlag(null));
    }

    [Fact]
    public void Property_scope_is_a_parsable_guid_or_the_whole_po()
    {
        var id = Guid.NewGuid();
        Assert.Equal(id, PoEnfazFinanceFlagRules.ParsePropertyId($" {id} "));
        Assert.Null(PoEnfazFinanceFlagRules.ParsePropertyId("not-a-guid"));
        Assert.Null(PoEnfazFinanceFlagRules.ParsePropertyId("  "));
        Assert.Null(PoEnfazFinanceFlagRules.ParsePropertyId(null));
    }

    [Fact]
    public void Notes_are_trimmed_capped_and_null_when_blank()
    {
        Assert.Null(PoEnfazFinanceFlagRules.NormalizeNote("   "));
        Assert.Equal("why", PoEnfazFinanceFlagRules.NormalizeNote("  why "));
        Assert.Equal(1000, PoEnfazFinanceFlagRules.NormalizeNote(new string('n', 1200))!.Length);
    }

    [Fact]
    public void A_set_lands_on_the_flag_of_the_same_scope()
    {
        var property = Guid.NewGuid();
        var poWide = Flag(null);
        var scoped = Flag(property);

        Assert.Same(scoped, PoEnfazFinanceFlagRules.MatchFlag([poWide, scoped], property));
        Assert.Same(poWide, PoEnfazFinanceFlagRules.MatchFlag([scoped, poWide], null));
        Assert.Null(PoEnfazFinanceFlagRules.MatchFlag([poWide], Guid.NewGuid()));
    }

    [Fact]
    public void A_clear_removes_exactly_the_requested_scope()
    {
        var property = Guid.NewGuid();
        var poWide = Flag(null);
        var scoped = Flag(property);
        var other = Flag(Guid.NewGuid());

        Assert.Same(poWide, Assert.Single(PoEnfazFinanceFlagRules.FlagsToClear([poWide, scoped, other], null)));
        Assert.Same(scoped, Assert.Single(PoEnfazFinanceFlagRules.FlagsToClear([poWide, scoped, other], property)));
        Assert.Empty(PoEnfazFinanceFlagRules.FlagsToClear([poWide], Guid.NewGuid()));
    }

    [Fact]
    public void New_and_applied_flags_carry_scope_note_and_actor()
    {
        var property = Guid.NewGuid();
        var created = PoEnfazFinanceFlagRules.NewFlag("PO-1", property, PoEnfazFinanceFlagKind.Difficult, "n", "u-1", Now);
        Assert.Equal("PO-1", created.PoNumber);
        Assert.Equal(property, created.PropertyId);
        Assert.Equal(PoEnfazFinanceFlagKind.Difficult, created.Flag);
        Assert.Equal("n", created.Note);
        Assert.Equal("u-1", created.SetByUserId);
        Assert.Equal(Now, created.SetAtUtc);

        var existing = Flag(null);
        PoEnfazFinanceFlagRules.ApplyFlag(existing, PoEnfazFinanceFlagKind.Excluded, null, "u-2", Now);
        Assert.Equal(PoEnfazFinanceFlagKind.Excluded, existing.Flag);
        Assert.Null(existing.Note);
        Assert.Equal("u-2", existing.SetByUserId);
        Assert.Equal(Now, existing.SetAtUtc);
    }
}
