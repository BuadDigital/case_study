using System.Runtime.CompilerServices;
using System.Text.Json;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The server reads typed numbers by the screens' rule: every case in
/// tests/fixtures/locale-number-cases.json (also read by parseLocaleNumber's tests) must agree.
/// </summary>
public class LocaleNumberTests
{
    public static TheoryData<string, decimal?> FixtureCases()
    {
        var path = Path.Combine(RepoRoot(), "tests", "fixtures", "locale-number-cases.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var data = new TheoryData<string, decimal?>();
        foreach (var c in doc.RootElement.GetProperty("cases").EnumerateArray())
        {
            var expected = c.GetProperty("expected");
            data.Add(
                c.GetProperty("input").GetString()!,
                expected.ValueKind == JsonValueKind.Null ? null : expected.GetDecimal());
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(FixtureCases))]
    public void Matches_the_shared_fixture(string input, decimal? expected)
    {
        var ok = LocaleNumber.TryParse(input, out var value);
        Assert.Equal(expected is not null, ok);
        if (expected is not null) Assert.Equal(expected.Value, value);
    }

    [Fact]
    public void Fixture_is_not_empty()
    {
        Assert.True(FixtureCases().Count >= 20);
    }

    [Fact]
    public void Null_is_not_a_number()
    {
        Assert.False(LocaleNumber.TryParse(null, out _));
        Assert.Null(LocaleNumber.ParseOrNull(null));
    }

    [Theory]
    [InlineData("500", 500)]
    [InlineData("١٢٣٫٥ م²", 123.5)]
    [InlineData("1,250", 1250)]
    [InlineData("0.5", 0.5)]
    public void Positive_text_parses_to_its_value(string input, double expected)
    {
        Assert.True(LocaleNumber.TryParsePositive(input, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("0")]
    [InlineData("-5")]
    [InlineData("abc")]
    [InlineData("1,2,3")]
    public void Zero_negative_and_non_numbers_are_not_positive_and_leave_zero(string? input)
    {
        Assert.False(LocaleNumber.TryParsePositive(input, out var value));
        Assert.Equal(0m, value);
    }

    [Fact]
    public void Other_unicode_digits_are_not_numbers()
    {
        // Bengali digits match \d in .NET but are not a digit system people type here.
        Assert.False(LocaleNumber.TryParse("১২", out _));
    }

    [Fact]
    public void DigitsOnly_maps_arabic_digits_so_an_arabic_mobile_normalizes()
    {
        Assert.Equal("0551234567", Texts.DigitsOnly("٠٥٥١٢٣٤٥٦٧"));
        Assert.Equal("+966551234567", SaudiMobiles.Normalize("٠٥٥١٢٣٤٥٦٧"));
        Assert.Equal("+966551234567", SaudiMobiles.Normalize("۰۵۵ ۱۲۳ ۴۵۶۷"));
    }

    private static string RepoRoot([CallerFilePath] string thisFile = "")
    {
        foreach (var start in new[] { AppContext.BaseDirectory, Path.GetDirectoryName(thisFile) ?? "" })
        {
            var dir = start;
            while (!string.IsNullOrEmpty(dir))
            {
                if (File.Exists(Path.Combine(dir, "backend", "RealEstateEval.slnx")))
                    return dir;
                dir = Directory.GetParent(dir)?.FullName ?? "";
            }
        }
        throw new InvalidOperationException("Could not locate the repository root (backend/RealEstateEval.slnx).");
    }
}

/// <summary>"Today" and "this year" are Riyadh's (UTC+3), not the UTC day.</summary>
public class RiyadhClockTests
{
    private static readonly DateTime LateEveningUtc = new(2026, 10, 8, 22, 30, 0, DateTimeKind.Utc);
    private static readonly DateTime NewYearsEveUtc = new(2026, 12, 31, 22, 30, 0, DateTimeKind.Utc);

    [Fact]
    public void Today_is_the_riyadh_day()
    {
        Assert.Equal(new DateOnly(2026, 10, 9), RiyadhClock.Today(LateEveningUtc));
        Assert.Equal(new DateOnly(2026, 10, 9), RiyadhClock.Today(new FixedTime(LateEveningUtc)));
        Assert.Equal(new DateOnly(2026, 10, 9), RiyadhClock.Today(new DateTimeOffset(LateEveningUtc)));
        Assert.Equal(new DateOnly(2026, 10, 8), RiyadhClock.Today(LateEveningUtc.AddHours(-2)));
    }

    [Fact]
    public void Year_is_the_riyadh_year()
    {
        Assert.Equal(2027, RiyadhClock.Year(NewYearsEveUtc));
        Assert.Equal(2027, RiyadhClock.Year(new FixedTime(NewYearsEveUtc)));
        Assert.Equal(2027, ReferenceNumbering.RiyadhYear(NewYearsEveUtc));
        Assert.Equal(2026, RiyadhClock.Year(NewYearsEveUtc.AddHours(-2)));
    }

    [Fact]
    public void Riyadh_wall_clock_round_trips_to_utc()
    {
        var riyadh = RiyadhClock.ToRiyadh(LateEveningUtc);
        Assert.Equal(new DateTime(2026, 10, 9, 1, 30, 0), riyadh);
        Assert.Equal(LateEveningUtc, RiyadhClock.ToUtc(riyadh));
        Assert.Equal(
            new DateTime(2026, 10, 9, 14, 0, 0, DateTimeKind.Utc),
            RiyadhClock.ToUtc(new DateOnly(2026, 10, 9), TimeSpan.FromHours(17)));
    }

    [Fact]
    public void Unparsable_request_date_falls_back_to_the_riyadh_day()
    {
        Assert.Equal(new DateOnly(2026, 10, 9), ValuationRequest.ParseRequestDate("garbage", LateEveningUtc));
    }

    [Fact]
    public void Approval_date_is_checked_against_the_riyadh_day()
    {
        Assert.True(ValuationReportDraft.IsApprovalDate("2026-10-10", LateEveningUtc));
        Assert.False(ValuationReportDraft.IsApprovalDate("2026-10-07", LateEveningUtc));
    }

    [Fact]
    public void Report_date_is_the_approved_drafts_date_only_once_approved()
    {
        Assert.Equal(
            new DateOnly(2026, 10, 5),
            ValuationReportDraft.ApprovedDateOf(ReportDraftStatuses.Approved, "2026-10-05"));
        Assert.Null(ValuationReportDraft.ApprovedDateOf(ReportDraftStatuses.Sent, "2026-10-05"));
        Assert.Null(ValuationReportDraft.ApprovedDateOf(ReportDraftStatuses.Approved, null));
    }

    private sealed class FixedTime(DateTime utc) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(utc);
    }
}
