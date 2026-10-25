using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Enfaz invoice decisions: the number and attachment set of an issue, what an issue writes on
/// the invoice row, the collection guards and the status they lead to, overdue, and the aging
/// report over already-loaded open invoices. Pure — the service loads, audits and saves.
/// </summary>
public static class PoEnfazInvoiceRules
{
    public static string InvoiceNumber(string poNumber, DateTime nowUtc) =>
        $"INV-{poNumber}-{nowUtc:yyyyMMddHHmmss}";

    /// <summary>Key attachments of the billed done lines, plus what the billing already carries.</summary>
    public static IEnumerable<string> IssueAttachmentIds(PoEnfazBillingDto billing) =>
        billing.Lines
            .Where(l => l.IncludedInBilling && l.WorkStatus == InspectorFeeWorkStatuses.Done)
            .SelectMany(l => l.KeyAttachmentIds)
            .Concat(billing.AttachmentIds)
            .Distinct(StringComparer.OrdinalIgnoreCase);

    public const string LinesLockedAfterIssueAr = "لا يمكن تعديل بنود الفوترة بعد إصدار الفاتورة.";

    /// <summary>
    /// An issued invoice (it has a number) stamps the totals it was issued with, so the fee lines
    /// behind it are frozen. Null while no invoice is issued.
    /// </summary>
    public static string? LinesLockedError(PoEnfazInvoice? invoice) =>
        IsIssued(invoice) ? LinesLockedAfterIssueAr : null;

    /// <summary>Issued means it has a number — the one test the line lock and a re-issue share.</summary>
    public static bool IsIssued(PoEnfazInvoice? invoice) =>
        invoice is not null && !string.IsNullOrWhiteSpace(invoice.InvoiceNumber);

    public const string NotReadyError =
        "تعذّر إصدار الفاتورة — تحقق من تعليم كل صكوك أمر العمل «جاهز للفوترة» وتعبئة الأتعاب.";

    public const string AlreadyIssuedError =
        "الفاتورة صادرة سلفاً — لا يمكن إعادة إصدارها بعد الإصدار.";

    /// <summary>
    /// One invoice per PO: once issued (whatever its collection state) it is never issued again —
    /// a second issue used to reset the collected amount to 0 under a new invoice number.
    /// </summary>
    public static string? IssueBlockedReason(PoEnfazInvoice? existing, bool readyForBilling, decimal subtotalSar)
    {
        if (IsIssued(existing))
            return AlreadyIssuedError;
        return readyForBilling && subtotalSar > 0 ? null : NotReadyError;
    }

    /// <summary>Stamps a first issue: the totals, a fresh number, and collection starting at zero.</summary>
    public static void ApplyIssue(
        PoEnfazInvoice invoice,
        PoEnfazBillingDto billing,
        string invoiceNumber,
        DateTime issuedAtUtc,
        string? attachmentIdsJson)
    {
        invoice.InvoiceNumber = invoiceNumber;
        invoice.IssuedAtUtc = issuedAtUtc;
        invoice.Status = PoEnfazInvoiceStatus.Issued;
        invoice.SubtotalSar = billing.SubtotalSar;
        invoice.VatSar = billing.VatSar;
        invoice.TotalSar = billing.TotalSar;
        invoice.CollectedAmountSar = 0m;
        invoice.CollectedAtUtc = null;
        invoice.AttachmentIdsJson = attachmentIdsJson;
    }

    /// <summary>Outcome of the collection guards: the amount to add and the running total, or an error.</summary>
    public sealed record CollectionCheck(string? Error, decimal Amount, decimal NextCollected);

    /// <summary>A collection must be positive, land on an open invoice, and not exceed its total.</summary>
    public static CollectionCheck ValidateCollection(PoEnfazInvoice invoice, decimal requestedAmountSar)
    {
        if (invoice.Status == PoEnfazInvoiceStatus.Collected
            || invoice.CollectedAmountSar + 0.009m >= invoice.TotalSar)
            return new CollectionCheck("الفاتورة محصّلة بالكامل.", 0m, 0m);

        var amount = Math.Max(0m, requestedAmountSar);
        if (amount <= 0m)
            return new CollectionCheck("مبلغ التحصيل يجب أن يكون أكبر من صفر.", 0m, 0m);

        var nextCollected = invoice.CollectedAmountSar + amount;
        if (nextCollected > invoice.TotalSar + 0.01m)
            return new CollectionCheck("مبلغ التحصيل يتجاوز إجمالي الفاتورة.", 0m, 0m);

        return new CollectionCheck(null, amount, nextCollected);
    }

    /// <summary>Collected once the running total reaches the invoice total (to the halala).</summary>
    public static string StatusAfterCollection(decimal collectedSar, decimal totalSar) =>
        collectedSar + 0.009m >= totalSar
            ? PoEnfazInvoiceStatus.Collected
            : PoEnfazInvoiceStatus.PartiallyCollected;

    /// <summary>An open invoice is overdue once it has been out longer than the grace period.</summary>
    public static bool IsOverdue(PoEnfazInvoice? invoice, DateTime nowUtc) =>
        invoice is not null
        && invoice.Status != PoEnfazInvoiceStatus.Collected
        && nowUtc - invoice.IssuedAtUtc > PoEnfazBillingDtoBuilder.OverdueAfter;

    /// <summary>
    /// Open receivables bucketed by age. Invoices with nothing outstanding drop out; rows are
    /// oldest first, then by PO.
    /// </summary>
    public static EnfazAgingReportDto BuildAgingReport(
        IReadOnlyList<PoEnfazInvoice> invoices,
        DateTime asOfUtc)
    {
        var rows = new List<EnfazAgingInvoiceRowDto>(invoices.Count);
        foreach (var invoice in invoices)
        {
            var outstanding = Math.Max(0m, invoice.TotalSar - invoice.CollectedAmountSar);
            if (outstanding <= 0.009m)
                continue;

            var ageDays = Math.Max(0, (int)Math.Floor((asOfUtc - invoice.IssuedAtUtc).TotalDays));
            var (bucketKey, bucketLabel) = PoEnfazFollowupRules.ResolveAgingBucket(ageDays);
            rows.Add(new EnfazAgingInvoiceRowDto
            {
                PoNumber = invoice.PoNumber,
                InvoiceNumber = invoice.InvoiceNumber,
                Status = invoice.Status,
                IssuedAtUtc = invoice.IssuedAtUtc,
                AgeDays = ageDays,
                BucketKey = bucketKey,
                BucketLabel = bucketLabel,
                TotalSar = invoice.TotalSar,
                CollectedAmountSar = invoice.CollectedAmountSar,
                OutstandingSar = Math.Round(outstanding, 2, MidpointRounding.AwayFromZero),
            });
        }

        var buckets = new[]
        {
            ("0_30", "0–30 يوماً"),
            ("31_60", "31–60 يوماً"),
            ("61_90", "61–90 يوماً"),
            ("90_plus", "أكثر من 90 يوماً"),
        }.Select(def =>
        {
            var inBucket = rows.Where(r => r.BucketKey == def.Item1).ToList();
            return new EnfazAgingBucketDto
            {
                Key = def.Item1,
                Label = def.Item2,
                InvoiceCount = inBucket.Count,
                OutstandingSar = inBucket.Sum(r => r.OutstandingSar),
            };
        }).ToList();

        return new EnfazAgingReportDto
        {
            AsOfUtc = asOfUtc,
            TotalOutstandingSar = rows.Sum(r => r.OutstandingSar),
            OpenInvoiceCount = rows.Count,
            Buckets = buckets,
            Invoices = rows
                .OrderByDescending(r => r.AgeDays)
                .ThenBy(r => r.PoNumber, StringComparer.Ordinal)
                .ToList(),
        };
    }
}
