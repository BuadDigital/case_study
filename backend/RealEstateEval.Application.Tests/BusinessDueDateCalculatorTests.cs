using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class BusinessDueDateCalculatorTests
{
    [Fact]
    public void Compute_counts_receipt_day_when_before_cutoff()
    {
        var due = BusinessDueDateCalculator.Compute(
            new DateOnly(2026, 6, 7),
            "10:00");

        Assert.Equal(new DateOnly(2026, 6, 10), due);
    }

    [Fact]
    public void Compute_starts_next_business_day_after_cutoff()
    {
        var due = BusinessDueDateCalculator.Compute(
            new DateOnly(2026, 6, 7),
            "18:00");

        Assert.Equal(new DateOnly(2026, 6, 11), due);
    }

    [Fact]
    public void Compute_defaults_missing_time_to_morning()
    {
        var due = BusinessDueDateCalculator.Compute(new DateOnly(2026, 6, 7), null);

        Assert.Equal(new DateOnly(2026, 6, 10), due);
    }

    [Fact]
    public void Compute_skips_weekend_when_received_on_friday()
    {
        // Friday 2026-06-12 → effective start Sunday 2026-06-15
        var due = BusinessDueDateCalculator.Compute(new DateOnly(2026, 6, 12), "10:00");

        Assert.Equal(new DateOnly(2026, 6, 17), due);
    }

    [Fact]
    public void Compute_skips_weekend_when_received_on_saturday()
    {
        var due = BusinessDueDateCalculator.Compute(new DateOnly(2026, 6, 13), "10:00");

        Assert.Equal(new DateOnly(2026, 6, 17), due);
    }

    [Fact]
    public void Compute_treats_cutoff_hour_as_after_hours()
    {
        var due = BusinessDueDateCalculator.Compute(new DateOnly(2026, 6, 8), "17:00");

        Assert.Equal(new DateOnly(2026, 6, 14), due);
    }

    [Fact]
    public void Compute_uses_ten_business_days_for_private_sector()
    {
        // Sun 2026-06-07 → 10 business days = Thu 2026-06-18
        var due = BusinessDueDateCalculator.Compute(
            new DateOnly(2026, 6, 7),
            "10:00",
            BusinessDueDateCalculator.PrivateSectorBusinessDays);

        Assert.Equal(new DateOnly(2026, 6, 18), due);
    }
}
