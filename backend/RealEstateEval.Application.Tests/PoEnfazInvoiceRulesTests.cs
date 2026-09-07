using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>Invoice issue, collection, overdue and aging rules extracted out of PoEnfazBillingService.</summary>
public class PoEnfazInvoiceRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 2, 8, 0, 0, DateTimeKind.Utc);

    private static PoEnfazInvoice Invoice(
        decimal total = 1150m,
        decimal collected = 0m,
        string status = PoEnfazInvoiceStatus.Issued,
        DateTime? issuedAt = null,
        string po = "PO-1") => new()
        {
            PoNumber = po,
            InvoiceNumber = $"INV-{po}",
            IssuedAtUtc = issuedAt ?? Now,
            Status = status,
            SubtotalSar = 1000m,
            VatSar = 150m,
            TotalSar = total,
            CollectedAmountSar = collected,
        };

    private static PoEnfazRevenueLineDto Line(
        string status = InspectorFeeWorkStatuses.Done,
        bool included = true,
        params string[] attachments) => new()
        {
            WorkStatus = status,
            IncludedInBilling = included,
            KeyAttachmentIds = attachments,
        };

    [Fact]
    public void Invoice_number_carries_the_po_and_the_issue_second()
    {
        Assert.Equal(
            "INV-PO-7-20260302080000",
            PoEnfazInvoiceRules.InvoiceNumber("PO-7", Now));
    }

    [Fact]
    public void Issue_attachments_come_from_billed_done_lines_plus_the_billing_set()
    {
        var billing = new PoEnfazBillingDto
        {
            AttachmentIds = ["c", "A"],
            Lines =
            [
                Line(attachments: ["a", "b"]),
                Line(status: InspectorFeeWorkStatuses.InProgress, attachments: ["x"]),
                Line(included: false, attachments: ["y"]),
            ],
        };

        Assert.Equal(["a", "b", "c"], PoEnfazInvoiceRules.IssueAttachmentIds(billing));
    }

    [Fact]
    public void An_issue_restates_the_totals_and_resets_collection()
    {
        var invoice = Invoice(collected: 400m, status: PoEnfazInvoiceStatus.PartiallyCollected);
        invoice.CollectedAtUtc = Now;
        var billing = new PoEnfazBillingDto { SubtotalSar = 2000m, VatSar = 300m, TotalSar = 2300m };

        PoEnfazInvoiceRules.ApplyIssue(invoice, billing, "INV-X", Now, "[\"a\"]");

        Assert.Equal("INV-X", invoice.InvoiceNumber);
        Assert.Equal(PoEnfazInvoiceStatus.Issued, invoice.Status);
        Assert.Equal(2300m, invoice.TotalSar);
        Assert.Equal(0m, invoice.CollectedAmountSar);
        Assert.Null(invoice.CollectedAtUtc);
        Assert.Equal("[\"a\"]", invoice.AttachmentIdsJson);
    }

    [Fact]
    public void Collection_is_refused_on_a_settled_invoice()
    {
        Assert.Equal(
            "الفاتورة محصّلة بالكامل.",
            PoEnfazInvoiceRules.ValidateCollection(
                Invoice(status: PoEnfazInvoiceStatus.Collected), 10m).Error);
        Assert.Equal(
            "الفاتورة محصّلة بالكامل.",
            PoEnfazInvoiceRules.ValidateCollection(Invoice(collected: 1149.995m), 10m).Error);
    }

    [Fact]
    public void Collection_must_be_positive_and_within_the_total()
    {
        Assert.Equal(
            "مبلغ التحصيل يجب أن يكون أكبر من صفر.",
            PoEnfazInvoiceRules.ValidateCollection(Invoice(), -5m).Error);
        Assert.Equal(
            "مبلغ التحصيل يتجاوز إجمالي الفاتورة.",
            PoEnfazInvoiceRules.ValidateCollection(Invoice(collected: 1000m), 150.02m).Error);

        var ok = PoEnfazInvoiceRules.ValidateCollection(Invoice(collected: 1000m), 100m);
        Assert.Null(ok.Error);
        Assert.Equal(100m, ok.Amount);
        Assert.Equal(1100m, ok.NextCollected);
    }

    [Theory]
    [InlineData(1150.0, PoEnfazInvoiceStatus.Collected)]
    [InlineData(1149.995, PoEnfazInvoiceStatus.Collected)]
    [InlineData(1149.98, PoEnfazInvoiceStatus.PartiallyCollected)]
    public void Status_after_collection_settles_to_the_halala(double collected, string expected)
    {
        Assert.Equal(expected, PoEnfazInvoiceRules.StatusAfterCollection((decimal)collected, 1150m));
    }

    [Fact]
    public void Overdue_is_an_open_invoice_older_than_the_grace_period()
    {
        Assert.False(PoEnfazInvoiceRules.IsOverdue(null, Now));
        Assert.False(PoEnfazInvoiceRules.IsOverdue(Invoice(issuedAt: Now.AddDays(-31)), Now.AddDays(-1)));
        Assert.False(PoEnfazInvoiceRules.IsOverdue(
            Invoice(status: PoEnfazInvoiceStatus.Collected, issuedAt: Now.AddDays(-60)), Now));
        Assert.True(PoEnfazInvoiceRules.IsOverdue(Invoice(issuedAt: Now.AddDays(-31)), Now));
    }

    [Fact]
    public void Aging_report_buckets_open_invoices_and_drops_settled_ones()
    {
        var report = PoEnfazInvoiceRules.BuildAgingReport(
            [
                Invoice(po: "PO-B", issuedAt: Now.AddDays(-45), collected: 150m),
                Invoice(po: "PO-A", issuedAt: Now.AddDays(-45)),
                Invoice(po: "PO-C", issuedAt: Now.AddDays(-100)),
                Invoice(po: "PO-D", issuedAt: Now.AddDays(-5), collected: 1150m),
            ],
            Now);

        Assert.Equal(Now, report.AsOfUtc);
        Assert.Equal(3, report.OpenInvoiceCount);
        Assert.Equal(1000m + 1150m + 1150m, report.TotalOutstandingSar);
        Assert.Equal(["PO-C", "PO-A", "PO-B"], report.Invoices.Select(r => r.PoNumber));
        Assert.Equal(["0_30", "31_60", "61_90", "90_plus"], report.Buckets.Select(b => b.Key));
        Assert.Equal(2, report.Buckets.Single(b => b.Key == "31_60").InvoiceCount);
        Assert.Equal(2150m, report.Buckets.Single(b => b.Key == "31_60").OutstandingSar);
        Assert.Equal(1, report.Buckets.Single(b => b.Key == "90_plus").InvoiceCount);
        Assert.Equal(0, report.Buckets.Single(b => b.Key == "0_30").InvoiceCount);
    }
}
