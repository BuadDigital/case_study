using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>Builds the issued Arabic RTL valuation report PDF from the live document DTO.</summary>
public static class ValuationReportPdfGenerator
{
    private static bool _licenseConfigured;

    /// <summary>
    /// Q-6-4: deposit-certificate data for the final copy — attached page + code in page metadata.
    /// </summary>
    public sealed record IssuanceCertificateStamp(
        string DepositCode,
        string? CertificateFileName,
        string? CertificateContentType,
        byte[]? CertificateContent);

    public static byte[] Generate(
        ValuationReportDocumentDto doc,
        IssuanceCertificateStamp? certificate = null)
    {
        EnsureLicense();

        var reportNo = string.IsNullOrWhiteSpace(doc.ReportNumber)
            ? doc.DisplayId
            : doc.ReportNumber.Trim();

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
                    col.Item().AlignCenter().Text("تقرير التقييم العقاري")
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
                                c.Item().Text($"رقم التقرير: {reportNo}").SemiBold();
                                c.Item().Text($"طلب التقييم: {doc.DisplayId}");
                            });
                            row.RelativeItem().AlignLeft().Column(c =>
                            {
                                c.Item().AlignLeft()
                                    .Text($"التاريخ: {doc.ReportDateDisplay}");
                                if (!string.IsNullOrWhiteSpace(doc.ValidUntilDisplay))
                                {
                                    c.Item().AlignLeft()
                                        .Text($"الصلاحية حتى: {doc.ValidUntilDisplay}");
                                }
                            });
                        });
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    // Decision 23: one line labels the whole package — "standard texts — package version N".
                    col.Item().PaddingBottom(6)
                        .Text($"النصوص المعيارية/القانونية — الحزمة نسخة {doc.TextPackageVersion}")
                        .FontSize(8).FontColor(Colors.Grey.Darken1);

                    if (!string.IsNullOrWhiteSpace(doc.FinalOpinionDisplay))
                    {
                        col.Item().Text($"الرأي النهائي للقيمة: {doc.FinalOpinionDisplay}")
                            .SemiBold().FontSize(12);
                        if (!string.IsNullOrWhiteSpace(doc.FinalOpinionTafqit))
                        {
                            col.Item().PaddingTop(2)
                                .Text(doc.FinalOpinionTafqit)
                                .FontSize(10).FontColor(Colors.Grey.Darken1);
                        }
                    }

                    foreach (var section in doc.Sections.Where(s => s.Included))
                    {
                        col.Item().PaddingTop(12)
                            .Text($"{section.Number}. {section.TitleAr}")
                            .SemiBold().FontSize(12);

                        var fields = section.Fields
                            .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
                            .ToList();
                        if (fields.Count == 0)
                        {
                            if (!string.IsNullOrWhiteSpace(section.PreviewText))
                            {
                                col.Item().PaddingTop(4)
                                    .Text(section.PreviewText)
                                    .FontSize(9).FontColor(Colors.Grey.Darken1);
                            }
                            continue;
                        }

                        foreach (var field in fields)
                        {
                            col.Item().PaddingTop(3).Row(row =>
                            {
                                row.RelativeItem(1.2f).Text(field.Key)
                                    .FontSize(9).FontColor(Colors.Grey.Darken1);
                                row.RelativeItem(2).Text(field.Value ?? "—").FontSize(10);
                            });
                        }
                    }

                    if (doc.Comparables.Count > 0)
                    {
                        col.Item().PaddingTop(14).Text("المقارنات المعتمدة").SemiBold().FontSize(12);
                        col.Item().PaddingTop(6).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(28);
                                columns.RelativeColumn(1.4f);
                                columns.RelativeColumn(1.6f);
                                columns.RelativeColumn(1.1f);
                                columns.RelativeColumn(1.1f);
                            });
                            table.Header(header =>
                            {
                                header.Cell().Element(HeaderCell).Text("#");
                                header.Cell().Element(HeaderCell).Text("النوع");
                                header.Cell().Element(HeaderCell).Text("الصفقة");
                                header.Cell().Element(HeaderCell).Text("المساحة");
                                header.Cell().Element(HeaderCell).Text("السعر");
                            });
                            foreach (var row in doc.Comparables)
                            {
                                table.Cell().Element(BodyCell).Text(row.Index.ToString());
                                table.Cell().Element(BodyCell).Text(row.ComparablePropertyType);
                                table.Cell().Element(BodyCell).Text(row.TransactionCell);
                                table.Cell().Element(BodyCell).Text(row.AreaSqmDisplay);
                                table.Cell().Element(BodyCell).Text(row.PriceDisplay);
                            }
                        });
                    }
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("صفحة ");
                    text.CurrentPageNumber();
                    text.Span(" من ");
                    text.TotalPages();
                    // Q-6-4: code is filled into page metadata — final copy only.
                    if (certificate is not null)
                        text.Span($" · رمز الإيداع: {certificate.DepositCode}");
                });
            });

            // Q-6-4: deposit-certificate page enters the report as an attached page (Sulaiman wording) —
            // certificate and code alone are outside freeze scope.
            if (certificate is not null)
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(36);
                    page.DefaultTextStyle(x => x
                        .FontFamily(Fonts.Tahoma, Fonts.Arial, "Noto Sans Arabic", "DejaVu Sans")
                        .FontSize(10));
                    page.ContentFromRightToLeft();

                    page.Header().AlignCenter().Text("شهادة الإيداع — منصة قيمة")
                        .Bold().FontSize(16);

                    page.Content().PaddingTop(16).Column(col =>
                    {
                        col.Item().Text($"رمز الإيداع: {certificate.DepositCode}")
                            .SemiBold().FontSize(12);
                        if (!string.IsNullOrWhiteSpace(certificate.CertificateFileName))
                        {
                            col.Item().PaddingTop(4)
                                .Text($"مستند الشهادة: {certificate.CertificateFileName}")
                                .FontColor(Colors.Grey.Darken1);
                        }

                        var isImage = certificate.CertificateContent is { Length: > 0 }
                            && (certificate.CertificateContentType ?? "")
                                .StartsWith("image/", StringComparison.OrdinalIgnoreCase);
                        if (isImage)
                        {
                            col.Item().PaddingTop(12).AlignCenter()
                                .MaxHeight(640)
                                .Image(certificate.CertificateContent!)
                                .FitArea();
                        }
                        else
                        {
                            col.Item().PaddingTop(12)
                                .Text("الشهادة محفوظة مستنداً في ملف المعاملة (صيغة غير صورية) — "
                                      + "هذه الصفحة مرجعها ورمزها.")
                                .FontColor(Colors.Grey.Darken1);
                        }
                    });

                    page.Footer().AlignCenter().Text(text =>
                    {
                        text.Span("صفحة ");
                        text.CurrentPageNumber();
                        text.Span(" من ");
                        text.TotalPages();
                        text.Span($" · رمز الإيداع: {certificate.DepositCode}");
                    });
                });
            }
        }).GeneratePdf();

        static IContainer HeaderCell(IContainer c) =>
            c.DefaultTextStyle(x => x.SemiBold().FontSize(8).FontColor(Colors.White))
                .Background(Color.FromHex("#1F4E79"))
                .PaddingVertical(5)
                .PaddingHorizontal(4);

        static IContainer BodyCell(IContainer c) =>
            c.BorderBottom(0.5f)
                .BorderColor(Colors.Grey.Lighten2)
                .PaddingVertical(4)
                .PaddingHorizontal(4);
    }

    private static void EnsureLicense()
    {
        if (_licenseConfigured) return;
        QuestPDF.Settings.License = LicenseType.Community;
        _licenseConfigured = true;
    }
}
