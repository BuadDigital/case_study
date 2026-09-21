using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// Enfaz tax invoice on the same A4 official-letter chrome as خطاب التفويض
/// and إقرار صحة الموقع (letterhead, navy table, stamp).
/// </summary>
public static class EnfazInvoicePdfGenerator
{
    private static readonly CultureInfo Ar = CultureInfo.GetCultureInfo("ar-SA");
    private static readonly Color Navy = Color.FromHex("#0F2A4E");
    private static readonly Color Muted = Color.FromHex("#555555");
    private static readonly Color Ink = Color.FromHex("#1A1A1A");
    private static readonly Color TableBorder = Color.FromHex("#CDD4DE");
    private static readonly Color TableStripe = Color.FromHex("#F6F8FB");
    private static readonly Color SlotBorder = Color.FromHex("#C5CCD6");

    private const string CompanyName = "شركة إجادة المهنية للتقييم";
    private const string CompanyCr = "4030297680";

    private static bool _licenseConfigured;

    public static byte[] Generate(PoEnfazBillingDto billing)
    {
        EnsureLicense();

        var billable = billing.Lines
            .Where(l => l.WorkStatus == InspectorFeeWorkStatuses.Done && l.IncludedInBilling)
            .OrderBy(l => l.PropertyLabel, StringComparer.Ordinal)
            .ToList();

        var issuedAt = billing.InvoiceIssuedAtUtc?.ToLocalTime()
            ?? DateTime.Now;
        var invoiceNo = string.IsNullOrWhiteSpace(billing.InvoiceNumber)
            ? "—"
            : billing.InvoiceNumber.Trim();
        var poNumber = string.IsNullOrWhiteSpace(billing.PoNumber)
            ? "—"
            : billing.PoNumber.Trim();
        var hijri = FormatHijri(issuedAt);
        var gregorian = $"{issuedAt:yyyy/MM/dd} م";

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginTop(26, Unit.Millimetre);
                page.MarginBottom(42, Unit.Millimetre);
                page.MarginHorizontal(24, Unit.Millimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x
                    .FontFamily(Fonts.Tahoma, Fonts.Arial, "Noto Sans Arabic", "DejaVu Sans")
                    .FontSize(11)
                    .FontColor(Ink)
                    .LineHeight(1.45f));
                page.ContentFromRightToLeft();

                if (OfficialLetterAssets.Letterhead is { Length: > 0 } letterhead)
                    page.Background().Image(letterhead).FitUnproportionally();

                page.Header().Column(meta =>
                {
                    meta.Item().Element(c => { RefRow(c, "رقم الفاتورة:", invoiceNo); });
                    meta.Item().Element(c => { RefRow(c, "التاريخ:", hijri); });
                    meta.Item().Element(c => { RefRow(c, "الموافق:", gregorian); });
                });

                page.Content().PaddingTop(10, Unit.Millimetre).Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Text("مركز الإسناد والتصفية (إنفاذ)")
                            .Bold().FontSize(12);
                        row.AutoItem().Text("المحترمين").Bold().FontSize(12);
                    });

                    col.Item().PaddingTop(6).Text("السلام عليكم ورحمة الله وبركاته،")
                        .SemiBold();
                    col.Item().PaddingTop(2).PaddingBottom(5, Unit.Millimetre)
                        .Text(t =>
                        {
                            t.Span("الموضوع/ ").Bold();
                            t.Span("فاتورة ضريبية").Bold();
                        });

                    col.Item().PaddingBottom(5, Unit.Millimetre).Row(row =>
                    {
                        row.AutoItem().Text("أمر العمل:").SemiBold().FontColor(Muted);
                        row.ConstantItem(6);
                        row.RelativeItem().Text(poNumber).Bold().FontColor(Navy);
                    });

                    col.Item().Text(t =>
                    {
                        t.Justify();
                        t.Span("بالإشارة إلى الموضوع أعلاه، نحيطكم علماً بأن ");
                        t.Span($" {CompanyName} ").Bold();
                        t.Span("سجل تجاري رقم ");
                        t.Span(CompanyCr).Bold();
                        t.Span(" تصدر هذه الفاتورة الضريبية عن خدمات الدراسة والرفع والمفاتيح المرتبطة بأمر العمل المذكور، وفق البنود التالية:");
                    });

                    col.Item().PaddingTop(7, Unit.Millimetre).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(28);
                            columns.RelativeColumn(2.6f);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1.1f);
                            columns.RelativeColumn(1.2f);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderCell).Text("م");
                            header.Cell().Element(HeaderCell).Text("المعاملة");
                            header.Cell().Element(HeaderCell).Text("دخل الدراسة");
                            header.Cell().Element(HeaderCell).Text("دخل الرفع");
                            header.Cell().Element(HeaderCell).Text("مفاتيح");
                            header.Cell().Element(HeaderCell).Text("المجموع");
                        });

                        if (billable.Count == 0)
                        {
                            table.Cell().ColumnSpan(6).Element(c => BodyCell(c, even: false))
                                .AlignCenter()
                                .Text("لا توجد بنود مشمولة في الفاتورة.");
                        }
                        else
                        {
                            var seq = 1;
                            foreach (var line in billable)
                            {
                                var even = seq % 2 == 0;
                                var total = line.CaseStudyFeeSar + line.SurveyFeeSar + line.KeyFeeSar;
                                table.Cell().Element(c => BodyCell(c, even)).Text(seq.ToString(Ar));
                                table.Cell().Element(c => BodyCell(c, even, arabic: true))
                                    .AlignRight()
                                    .Text(string.IsNullOrWhiteSpace(line.PropertyLabel)
                                        ? "—"
                                        : line.PropertyLabel);
                                table.Cell().Element(c => BodyCell(c, even))
                                    .Text(FormatSar(line.CaseStudyFeeSar));
                                table.Cell().Element(c => BodyCell(c, even))
                                    .Text(FormatSar(line.SurveyFeeSar));
                                table.Cell().Element(c => BodyCell(c, even))
                                    .Text(FormatSar(line.KeyFeeSar));
                                table.Cell().Element(c => BodyCell(c, even))
                                    .Text(FormatSar(total));
                                seq++;
                            }
                        }
                    });

                    col.Item().PaddingTop(7, Unit.Millimetre).Table(facts =>
                    {
                        facts.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(1.1f);
                            columns.RelativeColumn(2.0f);
                        });

                        FactRow(facts, "المجموع قبل الضريبة", FormatSar(billing.SubtotalSar));
                        FactRow(facts, "ضريبة القيمة المضافة 15٪", FormatSar(billing.VatSar));
                        FactRow(facts, "الإجمالي شامل الضريبة", FormatSar(billing.TotalSar), emphasize: true);
                    });

                    col.Item().PaddingTop(10, Unit.Millimetre).Row(row =>
                    {
                        row.RelativeItem().AlignCenter().Column(sign =>
                        {
                            sign.Item().Text("التوقيع").FontSize(9).FontColor(Muted).SemiBold();
                            sign.Item().PaddingTop(3)
                                .Width(46, Unit.Millimetre)
                                .Height(24, Unit.Millimetre)
                                .BorderBottom(1)
                                .BorderColor(SlotBorder)
                                .Element(slot =>
                                {
                                    if (OfficialLetterAssets.Signature is { Length: > 0 } signatureBytes)
                                        slot.Padding(2).Image(signatureBytes).FitArea();
                                });
                        });
                        row.RelativeItem().AlignCenter().Column(stamp =>
                        {
                            stamp.Item().Text("ختم الشركة").FontSize(9).FontColor(Muted).SemiBold();
                            stamp.Item().PaddingTop(3)
                                .Width(46, Unit.Millimetre)
                                .Height(24, Unit.Millimetre)
                                .Border(1)
                                .BorderColor(SlotBorder)
                                .Element(slot =>
                                {
                                    if (OfficialLetterAssets.Stamp is { Length: > 0 } stampBytes)
                                        slot.Padding(2).Image(stampBytes).FitArea();
                                });
                        });
                    });
                });
            });
        }).GeneratePdf();
    }

    private static void RefRow(IContainer c, string label, string value) =>
        c.Row(row =>
        {
            row.AutoItem().Text(label).FontSize(9).SemiBold().FontColor(Muted);
            row.ConstantItem(4);
            row.AutoItem().Text(value).FontSize(9).Bold().FontColor(Navy);
        });

    private static void FactRow(
        TableDescriptor table,
        string label,
        string value,
        bool emphasize = false)
    {
        table.Cell().Element(c =>
            c.Background(Navy)
                .Border(0.5f)
                .BorderColor(Navy)
                .PaddingVertical(7)
                .PaddingHorizontal(8)
                .DefaultTextStyle(x => x.FontSize(10).FontColor(Colors.White).SemiBold())
        ).Text(label);

        table.Cell().Element(c =>
            c.Background(emphasize ? TableStripe : Colors.White)
                .Border(0.5f)
                .BorderColor(TableBorder)
                .PaddingVertical(7)
                .PaddingHorizontal(8)
                .DefaultTextStyle(x => emphasize
                    ? x.FontSize(11).SemiBold().FontColor(Navy)
                    : x.FontSize(10).FontColor(Ink))
        ).Text(value);
    }

    private static IContainer HeaderCell(IContainer c) =>
        c.DefaultTextStyle(x => x.SemiBold().FontSize(10).FontColor(Colors.White))
            .Background(Navy)
            .Border(0.5f)
            .BorderColor(Navy)
            .PaddingVertical(7)
            .PaddingHorizontal(6)
            .AlignCenter();

    private static IContainer BodyCell(IContainer c, bool even, bool arabic = false) =>
        c.DefaultTextStyle(x => x.FontSize(arabic ? 9 : 10).FontColor(Ink))
            .Background(even ? TableStripe : Colors.White)
            .Border(0.5f)
            .BorderColor(TableBorder)
            .PaddingVertical(7)
            .PaddingHorizontal(6)
            .AlignCenter();

    private static string FormatSar(decimal amount) =>
        $"{amount.ToString("N2", Ar)} ر.س";

    private static string FormatHijri(DateTime date)
    {
        var hijri = new UmAlQuraCalendar();
        var dt = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
        return $"{hijri.GetYear(dt):D4}/{hijri.GetMonth(dt):D2}/{hijri.GetDayOfMonth(dt):D2} هـ";
    }

    private static void EnsureLicense()
    {
        if (_licenseConfigured) return;
        QuestPDF.Settings.License = LicenseType.Community;
        _licenseConfigured = true;
    }
}
