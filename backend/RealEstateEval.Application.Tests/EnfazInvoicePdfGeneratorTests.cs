using System.Text;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class EnfazInvoicePdfGeneratorTests
{
    [Fact]
    public void Invoice_pdf_is_an_official_letter_document()
    {
        var pdf = EnfazInvoicePdfGenerator.Generate(SampleBilling());

        Assert.True(pdf.Length > 40_000);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(pdf, 0, 4));
    }

    [Fact]
    public void Empty_billable_lines_still_render_a_letter()
    {
        var pdf = EnfazInvoicePdfGenerator.Generate(new PoEnfazBillingDto
        {
            PoNumber = "PO-EMPTY",
            InvoiceNumber = "INV-EMPTY",
            InvoiceIssuedAtUtc = new DateTime(2026, 9, 21, 9, 0, 0, DateTimeKind.Utc),
            Lines = [],
        });

        Assert.Equal("%PDF", Encoding.ASCII.GetString(pdf, 0, 4));
        Assert.True(pdf.Length > 10_000);
    }

    private static PoEnfazBillingDto SampleBilling() => new()
    {
        PoNumber = "PO-068202",
        InvoiceNumber = "INV-PO-068202-20260921090000",
        InvoiceIssuedAtUtc = new DateTime(2026, 9, 21, 9, 0, 0, DateTimeKind.Utc),
        SubtotalSar = 1500m,
        VatSar = 225m,
        TotalSar = 1725m,
        Lines =
        [
            new PoEnfazRevenueLineDto
            {
                PropertyLabel = "صك 820120009534",
                WorkStatus = InspectorFeeWorkStatuses.Done,
                IncludedInBilling = true,
                CaseStudyFeeSar = 800m,
                SurveyFeeSar = 500m,
                KeyFeeSar = 200m,
            },
            new PoEnfazRevenueLineDto
            {
                PropertyLabel = "صك 715702003577",
                WorkStatus = InspectorFeeWorkStatuses.Done,
                IncludedInBilling = true,
                CaseStudyFeeSar = 0m,
                SurveyFeeSar = 0m,
                KeyFeeSar = 0m,
            },
        ],
    };
}
