using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class ValuerCredentialRulesTests
{
    private static readonly DateOnly Today = new(2026, 8, 16);

    [Fact]
    public void AllowsIssuance_when_both_valid()
    {
        var ok = ValuerCredentialRules.AllowsIssuance(
            "2027-01-01",
            "2027-06-01",
            Today,
            out var reason);
        Assert.True(ok);
        Assert.Null(reason);
    }

    [Fact]
    public void Blocks_when_license_expired()
    {
        var ok = ValuerCredentialRules.AllowsIssuance(
            "2026-01-01",
            "2027-06-01",
            Today,
            out var reason);
        Assert.False(ok);
        Assert.Contains("ترخيص", reason);
    }

    [Fact]
    public void Blocks_when_membership_expired()
    {
        var ok = ValuerCredentialRules.AllowsIssuance(
            "2027-01-01",
            "2026-01-01",
            Today,
            out var reason);
        Assert.False(ok);
        Assert.Contains("العضوية", reason);
    }

    [Fact]
    public void Blocks_when_dates_missing()
    {
        Assert.False(ValuerCredentialRules.AllowsIssuance(null, "2027-01-01", Today, out _));
        Assert.False(ValuerCredentialRules.AllowsIssuance("2027-01-01", "", Today, out _));
    }

    [Theory]
    [InlineData("2026-09-01", true)]
    [InlineData("2026-12-20", false)]
    [InlineData("2026-08-10", false)]
    public void Warning_window_60_days(string expires, bool warn)
    {
        Assert.Equal(warn, ValuerCredentialRules.IsWithinWarningWindow(expires, Today));
    }
}
