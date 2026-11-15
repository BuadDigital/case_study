using RealEstateEval.Valuation.Domain;
using static RealEstateEval.Valuation.Application.Rules.ValuationReportImportRules;

namespace RealEstateEval.Application.Tests;

public class ValuationReportImportRulesTests
{
    /// <summary>The headers as مقياس writes them, stray spaces included.</summary>
    private static readonly string?[] MeqyasHeader =
    [
        "رقم التقييم", "النموذج - الإسم العربي", "المعتمد - الإسم العربي", "تاريخ الإعتماد",
        "الجهة الطالبة - الإسم الرسمي العربي", " رقم الصك", "نوع العقار - الإسم العربي",
        "المعاين - الإسم العربي", "الإحداثيات - خط الطول", "الإحداثيات - خط العرض",
        "نوع الاستخدام - الإسم العربي", "مساحة الأرض  - المساحة", "تفقيط - قيمة التقييم النهائية",
        "مدقق المعاينة - الإسم العربي", "تاريخ التقييم الفعلي(م)",
    ];

    private static Dictionary<Field, int> Columns() => MatchColumns(MeqyasTemplate, MeqyasHeader).Columns;

    private static object?[] Row(object? number = null, object? lng = null, object? lat = null) =>
    [
        number ?? "052648", "سكني", "أحمد", new DateTime(2026, 9, 14), "بنك", "4400112233", "فيلا",
        "خالد", lng ?? 39.17, lat ?? 21.54, "سكني", 450.0, 1_850_000.0, "سعد", new DateTime(2026, 9, 10),
    ];

    [Fact]
    public void Matches_every_meqyas_column_despite_stray_spaces()
    {
        var (columns, missing) = MatchColumns(MeqyasTemplate, MeqyasHeader);

        Assert.Empty(missing);
        Assert.Equal(MeqyasTemplate.Count, columns.Count);
    }

    [Fact]
    public void Names_missing_required_columns()
    {
        var header = MeqyasHeader.Where(h => h != "الإحداثيات - خط الطول").ToArray();

        var (_, missing) = MatchColumns(MeqyasTemplate, header);

        Assert.Equal(new[] { "الإحداثيات - خط الطول" }, missing);
    }

    [Fact]
    public void Reads_a_valid_row_and_keeps_the_report_number_as_written()
    {
        var result = ReadRow(ValuationReportSources.Meqyas, Columns(), Row());

        Assert.Null(result.RejectReasonAr);
        Assert.NotNull(result.Report);
        Assert.Equal("052648", result.Report!.ReportNumber);
        Assert.Equal(52648, result.Report.ReportNumberValue);
        Assert.Equal(new DateOnly(2026, 9, 14), result.Report.ApprovedAt);
        Assert.Equal(1_850_000m, result.Report.FinalValue);
        Assert.Equal("4400112233", result.Report.DeedNumber);
    }

    [Theory]
    [InlineData("", 39.17, 21.54, "رقم التقييم فارغ أو غير رقمي")]
    [InlineData("12A", 39.17, 21.54, "رقم التقييم فارغ أو غير رقمي")]
    [InlineData("1", 0.0, 0.0, "إحداثيات فارغة أو صفرية")]
    [InlineData("1", 21.54, 39.17, "إحداثيات مقلوبة (خط الطول مكان خط العرض)")]
    [InlineData("1", 31.2, 30.0, "إحداثيات خارج المملكة")]
    public void Rejects_bad_rows_with_a_reason(string number, double lng, double lat, string reason)
    {
        var result = ReadRow(ValuationReportSources.Meqyas, Columns(), Row(number, lng, lat));

        Assert.Null(result.Report);
        Assert.Equal(reason, result.RejectReasonAr);
    }

    [Fact]
    public void Internal_gaps_are_ranges_of_missing_numbers()
    {
        var gaps = InternalGaps([5, 1, 2, 9, 2]);

        Assert.Equal(new[] { new NumberGap(3, 4, 2), new NumberGap(6, 8, 3) }, gaps);
    }

    [Theory]
    [InlineData(100, 101, 0)]
    [InlineData(100, 90, 0)]
    [InlineData(100, 160, 59)]
    public void Gap_after_previous_upload(long previousMax, long fileMin, long expected) =>
        Assert.Equal(expected, GapAfterPreviousUpload(previousMax, fileMin));

    [Fact]
    public void Pads_numbers_to_the_source_width() =>
        Assert.Equal("000417", PadNumber(417, 6));
}
