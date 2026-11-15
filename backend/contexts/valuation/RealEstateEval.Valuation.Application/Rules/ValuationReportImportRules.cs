using System.Globalization;
using System.Text.RegularExpressions;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Pure rules behind the valuation-report import: the source's column template, reading one sheet
/// row into a report, the rejection reasons, and the report-number gap checks. No I/O — the sheet
/// arrives as a header row and value rows (string, double or DateTime cells, as the Excel reader
/// returns them).
/// </summary>
public static partial class ValuationReportImportRules
{
    public enum Field
    {
        ReportNumber,
        Template,
        Approver,
        ApprovedAt,
        Client,
        DeedNumber,
        PropertyType,
        Inspector,
        Longitude,
        Latitude,
        Usage,
        LandArea,
        FinalValue,
        InspectionAuditor,
        ValuationDate,
    }

    public sealed record TemplateColumn(Field Field, string Header, bool Required);

    /// <summary>
    /// مقياس export headers as the program writes them. Matching ignores the stray spaces the export
    /// carries (« رقم الصك», «مساحة الأرض  - المساحة») — see <see cref="NormalizeHeader"/>.
    /// </summary>
    public static readonly IReadOnlyList<TemplateColumn> MeqyasTemplate =
    [
        new(Field.ReportNumber, "رقم التقييم", true),
        new(Field.Template, "النموذج - الإسم العربي", false),
        new(Field.Approver, "المعتمد - الإسم العربي", false),
        new(Field.ApprovedAt, "تاريخ الإعتماد", true),
        new(Field.Client, "الجهة الطالبة - الإسم الرسمي العربي", false),
        new(Field.DeedNumber, "رقم الصك", false),
        new(Field.PropertyType, "نوع العقار - الإسم العربي", true),
        new(Field.Inspector, "المعاين - الإسم العربي", false),
        new(Field.Longitude, "الإحداثيات - خط الطول", true),
        new(Field.Latitude, "الإحداثيات - خط العرض", true),
        new(Field.Usage, "نوع الاستخدام - الإسم العربي", false),
        new(Field.LandArea, "مساحة الأرض - المساحة", false),
        new(Field.FinalValue, "تفقيط - قيمة التقييم النهائية", false),
        new(Field.InspectionAuditor, "مدقق المعاينة - الإسم العربي", false),
        new(Field.ValuationDate, "تاريخ التقييم الفعلي(م)", false),
    ];

    public static IReadOnlyList<TemplateColumn>? TemplateFor(string source) =>
        source == ValuationReportSources.Meqyas ? MeqyasTemplate : null;

    /// <summary>Trim, collapse runs of whitespace, and one space on each side of «-».</summary>
    public static string NormalizeHeader(string? header)
    {
        var text = Whitespace().Replace((header ?? "").Trim(), " ");
        return DashSpacing().Replace(text, " - ");
    }

    /// <summary>Column index per template field; missing required headers by name.</summary>
    public static (Dictionary<Field, int> Columns, List<string> MissingRequired) MatchColumns(
        IReadOnlyList<TemplateColumn> template,
        IReadOnlyList<string?> headerRow)
    {
        var byHeader = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var i = 0; i < headerRow.Count; i++)
            byHeader.TryAdd(NormalizeHeader(headerRow[i]), i);

        var columns = new Dictionary<Field, int>();
        var missing = new List<string>();
        foreach (var column in template)
        {
            if (byHeader.TryGetValue(NormalizeHeader(column.Header), out var index))
                columns[column.Field] = index;
            else if (column.Required)
                missing.Add(column.Header);
        }
        return (columns, missing);
    }

    public sealed record RowResult(ImportedValuationReport? Report, string ReportNumber, string? PropertyType, DateOnly? ApprovedAt, string? RejectReasonAr);

    // Saudi Arabia's bounding box — a point outside it is a typing or export error.
    private const double MinLat = 16.0, MaxLat = 32.5, MinLng = 34.0, MaxLng = 56.0;

    /// <summary>One sheet row → a report, or the reason it is rejected (shown and downloaded for correction at the source).</summary>
    public static RowResult ReadRow(
        string source,
        IReadOnlyDictionary<Field, int> columns,
        IReadOnlyList<object?> row)
    {
        object? Cell(Field f) => columns.TryGetValue(f, out var i) && i < row.Count ? row[i] : null;

        var number = ReportNumberText(Cell(Field.ReportNumber));
        var propertyType = Text(Cell(Field.PropertyType));
        var approvedAt = Date(Cell(Field.ApprovedAt));

        RowResult Reject(string reason) => new(null, number, propertyType, approvedAt, reason);

        if (number.Length == 0 || !long.TryParse(number, NumberStyles.None, CultureInfo.InvariantCulture, out var numberValue))
            return Reject("رقم التقييم فارغ أو غير رقمي");

        var lng = Number(Cell(Field.Longitude));
        var lat = Number(Cell(Field.Latitude));
        if (lat is null || lng is null || lat == 0 || lng == 0)
            return Reject("إحداثيات فارغة أو صفرية");
        if (InSaudi(lng.Value, lat.Value) && !InSaudi(lat.Value, lng.Value))
            return Reject("إحداثيات مقلوبة (خط الطول مكان خط العرض)");
        if (!InSaudi(lat.Value, lng.Value))
            return Reject("إحداثيات خارج المملكة");

        var landArea = Number(Cell(Field.LandArea));
        var finalValue = Number(Cell(Field.FinalValue));
        var report = new ImportedValuationReport
        {
            Source = source,
            ReportNumber = number,
            ReportNumberValue = numberValue,
            Template = TextOrNull(Cell(Field.Template)),
            Approver = TextOrNull(Cell(Field.Approver)),
            ApprovedAt = approvedAt,
            Client = TextOrNull(Cell(Field.Client)),
            DeedNumber = TextOrNull(Cell(Field.DeedNumber)),
            PropertyType = propertyType ?? "",
            Inspector = TextOrNull(Cell(Field.Inspector)),
            Latitude = lat.Value,
            Longitude = lng.Value,
            Usage = Text(Cell(Field.Usage)) ?? "",
            LandArea = landArea is > 0 ? (decimal)landArea.Value : null,
            FinalValue = finalValue is > 0 ? Math.Round((decimal)finalValue.Value, 2) : null,
            InspectionAuditor = TextOrNull(Cell(Field.InspectionAuditor)),
            ValuationDate = Date(Cell(Field.ValuationDate)),
        };
        return new RowResult(report, number, propertyType, approvedAt, null);
    }

    private static bool InSaudi(double lat, double lng) =>
        lat is >= MinLat and <= MaxLat && lng is >= MinLng and <= MaxLng;

    public sealed record NumberGap(long From, long To, long Count);

    /// <summary>Numbers missing between the lowest and highest number of the file, as ranges.</summary>
    public static List<NumberGap> InternalGaps(IEnumerable<long> numbers)
    {
        var sorted = numbers.Distinct().Order().ToList();
        var gaps = new List<NumberGap>();
        for (var i = 1; i < sorted.Count; i++)
        {
            if (sorted[i] - sorted[i - 1] > 1)
                gaps.Add(new NumberGap(sorted[i - 1] + 1, sorted[i] - 1, sorted[i] - sorted[i - 1] - 1));
        }
        return gaps;
    }

    /// <summary>
    /// Numbers skipped between the source's previous upload and this file — 0 when the file starts
    /// right after (or overlaps) the previous one.
    /// </summary>
    public static long GapAfterPreviousUpload(long previousMax, long fileMin) =>
        fileMin > previousMax + 1 ? fileMin - previousMax - 1 : 0;

    /// <summary>A number at the width the source prints it (6 digits for مقياس: 052648).</summary>
    public static string PadNumber(long value, int width) =>
        value.ToString(CultureInfo.InvariantCulture).PadLeft(width, '0');

    private static string ReportNumberText(object? cell) => cell switch
    {
        null => "",
        double d => ((long)Math.Round(d)).ToString(CultureInfo.InvariantCulture),
        _ => (cell.ToString() ?? "").Trim(),
    };

    private static string? Text(object? cell)
    {
        if (cell is null) return null;
        var text = Whitespace().Replace(cell.ToString() ?? "", " ").Trim();
        return text.Length == 0 ? null : text;
    }

    private static string? TextOrNull(object? cell) => cell is double d
        ? d.ToString("0.##", CultureInfo.InvariantCulture)
        : Text(cell);

    private static double? Number(object? cell) => cell switch
    {
        null => null,
        double d => d,
        int i => i,
        decimal m => (double)m,
        _ => double.TryParse(
            (cell.ToString() ?? "").Replace(",", "").Trim(),
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out var parsed) ? parsed : null,
    };

    private static DateOnly? Date(object? cell) => cell switch
    {
        null => null,
        DateTime dt => DateOnly.FromDateTime(dt),
        double serial when serial > 0 => DateOnly.FromDateTime(DateTime.FromOADate(serial)),
        _ => DateTime.TryParse(cell.ToString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
            ? DateOnly.FromDateTime(parsed)
            : null,
    };

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"\s*-\s*")]
    private static partial Regex DashSpacing();
}
