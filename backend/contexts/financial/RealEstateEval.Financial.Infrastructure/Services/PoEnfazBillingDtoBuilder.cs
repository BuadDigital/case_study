using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

internal static class PoEnfazBillingDtoBuilder
{
    internal const decimal VatRate = 0.15m;
    internal static readonly TimeSpan OverdueAfter = TimeSpan.FromDays(30);

    internal static PoEnfazBillingDto BuildDto(
        string poNumber,
        bool poReady,
        IReadOnlyList<PoEnfazRevenueLineDto> lines,
        PoEnfazInvoice? invoice,
        DateTime utcNow)
    {
        var billable = lines
            .Where(l => l.WorkStatus == InspectorFeeWorkStatuses.Done && l.IncludedInBilling)
            .ToList();
 // ضريبة 15٪ على (تقييم + رفع) فقط — أتعاب المفاتيح شاملة الضريبة
        var taxable = billable.Sum(l => l.CaseStudyFeeSar + l.SurveyFeeSar);
        var keyFees = billable.Sum(l => l.KeyFeeSar);
        var vat = Math.Round(taxable * VatRate, 2, MidpointRounding.AwayFromZero);
        var total = taxable + vat + keyFees;
 // SubtotalSar = الأتعاب الخاضعة للضريبة (تقييم+رفع) — للتوافق مع واجهة الملخص
        var subtotal = taxable;
        var collected = invoice?.CollectedAmountSar ?? 0m;
        var status = invoice?.Status;
        var issuedAt = invoice?.IssuedAtUtc;
        var overdue = invoice is not null
            && status != PoEnfazInvoiceStatus.Collected
            && issuedAt.HasValue
            && utcNow - issuedAt.Value > OverdueAfter;

        var invoiceAttachments = ParseAttachmentIds(invoice?.AttachmentIdsJson);
        var lineAttachments = lines
            .SelectMany(l => l.KeyAttachmentIds)
            .Where(id => !string.IsNullOrWhiteSpace(id));
        var attachmentIds = invoiceAttachments.Count > 0
            ? invoiceAttachments
            : lineAttachments.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        return new PoEnfazBillingDto
        {
            PoNumber = poNumber,
            PoReadyForBilling = poReady,
            Lines = lines,
            SubtotalSar = invoice?.SubtotalSar > 0 ? invoice.SubtotalSar : subtotal,
            VatSar = invoice?.VatSar > 0 ? invoice.VatSar : vat,
            TotalSar = invoice?.TotalSar > 0 ? invoice.TotalSar : total,
            InvoiceNumber = invoice?.InvoiceNumber,
            InvoiceIssuedAtUtc = issuedAt,
            InvoiceStatus = status,
            CollectedAmountSar = collected,
            CollectedAtUtc = invoice?.CollectedAtUtc,
            IsOverdue = overdue,
            AttachmentIds = attachmentIds,
        };
    }

    internal static IReadOnlyList<string> ParseAttachmentIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        try
        {
            var ids = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
            return ids?
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList()
                ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

    internal static string? SerializeAttachmentIds(IEnumerable<string> ids)
    {
        var list = ids
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return list.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(list);
    }
}
