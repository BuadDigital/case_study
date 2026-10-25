using RealEstateEval.Valuation.Application.Rules;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// QA froze a copy saying 5,000,000 while the system computed 1,240,000 — approval now refuses a copy
/// whose banner does not carry the computed final value.
/// </summary>
public class ReportFinalValueMarkerTests
{
    private static string Banner(string marker) =>
        $"<section><div style=\"background:#102b4e\" {marker}><div><span>القيمة</span><span>1,240,000 ر.س.</span></div></div></section>";

    [Fact]
    public void A_copy_stating_the_computed_value_passes()
    {
        Assert.Null(ReportFinalValueMarker.Check(Banner("data-final-value=\"1240000\""), 1_240_000m));
        Assert.Null(ReportFinalValueMarker.Check(Banner("data-final-value=\"1240000.4\""), 1_240_000m));
    }

    [Fact]
    public void A_copy_stating_another_value_is_refused()
    {
        var error = ReportFinalValueMarker.Check(Banner("data-final-value=\"5000000\""), 1_240_000m);

        Assert.NotNull(error);
        Assert.Contains("5,000,000", error);
        Assert.Contains("1,240,000", error);
    }

    [Fact]
    public void A_copy_without_the_marker_is_refused()
    {
        Assert.Equal(ReportFinalValueMarker.MissingAr, ReportFinalValueMarker.Check(Banner(""), 1_240_000m));
    }
}
