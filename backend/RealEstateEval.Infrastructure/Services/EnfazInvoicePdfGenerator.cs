using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Builds an Arabic RTL Enfaz tax invoice PDF for a work order.</summary>
public static class EnfazInvoicePdfGenerator
{
    private static readonly CultureInfo Ar = CultureInfo.GetCultureInfo("ar-SA");
    private static bool _licenseConfigured;

    public static byte[] Generate(PoEnfazBillingDto billing)
    {
        EnsureLicense();

        var billable = billing.Lines
            .Where(l => l.WorkStatus == "done" && l.IncludedInBilling)
            .OrderBy(l => l.PropertyLabel, StringComparer.Ordinal)
            .ToList();

        var issuedAt = billing.InvoiceIssuedAtUtc?.ToLocalTime()
            ?? DateTime.Now;
        var invoiceNo = string.IsNullOrWhiteSpace(billing.InvoiceNumber)
            ? "—"
            : billing.InvoiceNumber.Trim();

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.DefaultTextStyle(x => x
                    .FontFamily(Fonts.Tahoma, Fonts.Arial, "Noto Sans Arabic", "DejaVu Sans")
                    .FontSize(10));
                page.ContentFromRightToLeft();

                page.Header().Column(col =>
                {
                    col.Item().AlignCenter().Text("فاتورة ضريبية — إنفاذ")
                        .Bold().FontSize(18);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("منصة دراسة الحالة العقارية")
                        .FontSize(11).FontColor(Colors.Grey.Darken1);
                    col.Item().PaddingTop(10).BorderBottom(1)
                        .BorderColor(Colors.Grey.Lighten2).PaddingBottom(8)
                        .Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text($"رقم الفاتورة: {invoiceNo}").SemiBold();
                                c.Item().Text($"أمر العمل: {billing.PoNumber}");
                            });
                            row.RelativeItem().AlignLeft().Column(c =>
                            {
                                c.Item().AlignLeft()
                                    .Text($"تاريخ الإصدار: {issuedAt:yyyy/MM/dd HH:mm}");
                                c.Item().AlignLeft().Text("ضريبة القيمة المضافة: 15٪");
                            });
                        });
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    col.Item().Text("تفاصيل الإيراد حسب المعاملة").SemiBold().FontSize(12);
                    col.Item().PaddingTop(8).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3.2f);
                            columns.RelativeColumn(1.4f);
                            columns.RelativeColumn(1.4f);
                            columns.RelativeColumn(1.4f);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderCell).Text("المعاملة");
                            header.Cell().Element(HeaderCell).AlignCenter().Text("دخل الدراسة");
                            header.Cell().Element(HeaderCell).AlignCenter().Text("دخل الرفع");
                            header.Cell().Element(HeaderCell).AlignCenter().Text("المجموع");
                        });

                        foreach (var line in billable)
                        {
                            var total = line.CaseStudyFeeSar + line.SurveyFeeSar;
                            table.Cell().Element(BodyCell).Text(line.PropertyLabel);
                            table.Cell().Element(BodyCell).AlignCenter()
                                .Text(FormatSar(line.CaseStudyFeeSar));
                            table.Cell().Element(BodyCell).AlignCenter()
                                .Text(FormatSar(line.SurveyFeeSar));
                            table.Cell().Element(BodyCell).AlignCenter()
                                .Text(FormatSar(total));
                        }

                        if (billable.Count == 0)
                        {
                            table.Cell().ColumnSpan(4).Element(BodyCell)
                                .AlignCenter().Text("لا توجد بنود مشمولة في الفاتورة.");
                        }
                    });

                    col.Item().PaddingTop(16).AlignLeft().Width(220).Column(totals =>
                    {
                        totals.Item().Row(r =>
                        {
                            r.RelativeItem().Text("المجموع قبل الضريبة");
                            r.ConstantItem(90).AlignLeft()
                                .Text(FormatSar(billing.SubtotalSar));
                        });
                        totals.Item().PaddingTop(4).Row(r =>
                        {
                            r.RelativeItem().Text("ضريبة القيمة المضافة 15٪");
                            r.ConstantItem(90).AlignLeft()
                                .Text(FormatSar(billing.VatSar));
                        });
                        totals.Item().PaddingTop(6).BorderTop(1)
                            .BorderColor(Colors.Grey.Medium).PaddingTop(6)
                            .Row(r =>
                            {
                                r.RelativeItem().Text("الإجمالي شامل الضريبة").SemiBold();
                                r.ConstantItem(90).AlignLeft()
                                    .Text(FormatSar(billing.TotalSar)).SemiBold();
                            });
                    });

                    col.Item().PaddingTop(24).Text(
                            "هذه فاتورة ضريبية صادرة من النظام لإيراد إنفاذ المرتبط بأمر العمل أعلاه.")
                        .FontSize(8).FontColor(Colors.Grey.Darken1);
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("صفحة ");
                    text.CurrentPageNumber();
                    text.Span(" من ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();

        static IContainer HeaderCell(IContainer c) =>
            c.DefaultTextStyle(x => x.SemiBold().FontSize(9).FontColor(Colors.White))
                .Background(Color.FromHex("#0F766E"))
                .PaddingVertical(6)
                .PaddingHorizontal(6);

        static IContainer BodyCell(IContainer c) =>
            c.BorderBottom(0.5f)
                .BorderColor(Colors.Grey.Lighten2)
                .PaddingVertical(5)
                .PaddingHorizontal(6);
    }

    private static string FormatSar(decimal amount) =>
        $"{amount.ToString("N2", Ar)} ر.س";

    private static void EnsureLicense()
    {
        if (_licenseConfigured) return;
        QuestPDF.Settings.License = LicenseType.Community;
        _licenseConfigured = true;
    }
}
