using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Services;

public sealed partial class KeyEnvelopesService
{
    public async Task<IReadOnlyList<KeyEnvelopeFeeReportRowDto>> ListFeeReportAsync(
        CancellationToken cancellationToken = default)
    {
        var charges = await _keyFees.ListAsync(cancellationToken);
        var chargedEnvelopeIds = charges.Select(c => c.EnvelopeId).ToHashSet();

        var entitlements = await _repo.ListRevenueEntitlementsAsync(MaxListRows, cancellationToken);

        var envelopes = entitlements.ToDictionary(e => e.Id);
        if (chargedEnvelopeIds.Except(envelopes.Keys).Any())
        {
            var missing = await _repo.ListByIdsAsync(
                chargedEnvelopeIds.Except(envelopes.Keys).ToList(),
                cancellationToken);
            foreach (var envelope in missing)
                envelopes[envelope.Id] = envelope;
        }

        var entitlementIds = entitlements.Select(e => e.Id).ToList();
        var enfazKeyLines = await _keyFees.ListKeyRevenueLinesAsync(entitlementIds, cancellationToken);
        var enfazInvoiceByPo = await _keyFees.GetInvoicesByPoAsync(
            enfazKeyLines.Select(l => l.PoNumber).Distinct().ToList(),
            cancellationToken);
        var enfazByEnvelope = enfazKeyLines
            .GroupBy(l => l.EnvelopeId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedAtUtc).First());

        var rows = charges.Select(c =>
        {
            envelopes.TryGetValue(c.EnvelopeId, out var env);
            return new KeyEnvelopeFeeReportRowDto
            {
                EnvelopeId = c.EnvelopeId,
                RequestNumber = c.RequestNumber,
                Court = env?.Court ?? "",
                Circuit = env?.Circuit ?? "",
                PhotoAttachmentId = c.PhotoAttachmentId ?? env?.PhotoAttachmentId,
                ReceiptAttachmentId = c.ReceiptAttachmentId ?? env?.ReceiptAttachmentId,
                FeeAmountSar = c.AmountSar,
                CollectionStatus = c.CollectionStatus,
                InvoiceReference = c.InvoiceReference,
                CollectedAtUtc = c.CollectedAtUtc,
                CreatedByName = c.CreatedByName,
                CreatedAtUtc = c.CreatedAtUtc,
            };
        }).ToList();

        rows.AddRange(entitlements
            .Where(e => !chargedEnvelopeIds.Contains(e.Id))
            .Select(e =>
            {
                enfazByEnvelope.TryGetValue(e.Id, out var line);
                PoEnfazInvoiceRefDto? invoice = null;
                if (line is not null)
                    enfazInvoiceByPo.TryGetValue(line.PoNumber.Trim(), out invoice);
                var collectedViaEnfaz = invoice is not null
                    && invoice.Status == PoEnfazInvoiceStatus.Collected;
                return new KeyEnvelopeFeeReportRowDto
                {
                    EnvelopeId = e.Id,
                    RequestNumber = e.RequestNumber,
                    Court = e.Court,
                    Circuit = e.Circuit,
                    PhotoAttachmentId = e.PhotoAttachmentId,
                    ReceiptAttachmentId = e.ReceiptAttachmentId,
                    FeeAmountSar = line?.KeyFeeSar > 0 ? line.KeyFeeSar : e.FeeAmountSar,
                    CollectionStatus = collectedViaEnfaz
                        ? KeyReceiptFeeStatuses.Collected
                        : KeyReceiptFeeStatuses.Open,
                    InvoiceReference = collectedViaEnfaz
                        ? $"مُحصَّل عبر فاتورة إنفاذ {invoice!.InvoiceNumber}"
                        : invoice?.InvoiceNumber is string inv
                            ? $"فوترة إنفاذ {inv}"
                            : null,
                    CollectedAtUtc = collectedViaEnfaz ? invoice!.CollectedAtUtc : null,
                    CreatedByName = e.CreatedByName,
                    CreatedAtUtc = e.CreatedAtUtc,
                };
            }));

        return rows
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(MaxListRows)
            .ToList();
    }

    public async Task<(KeyEnvelopeFeeReportRowDto? Row, string? Error)> MarkFeeCollectedAsync(
        Guid envelopeId,
        string? invoiceReference,
        CancellationToken cancellationToken = default)
    {
        var (charge, error) = await _keyFees.MarkCollectedAsync(
            envelopeId, invoiceReference, cancellationToken);
        if (error is not null)
        {
            var isEntitlement = await _repo.HasRevenueEntitlementAsync(envelopeId, cancellationToken);
            return (
                null,
                isEntitlement && error.Contains("غير موجود", StringComparison.Ordinal)
                    ? "لا مبلغ مختوم لهذا الظرف — تحصيل أتعاب الاستلام يتم ضمن فوترة إنفاذ"
                    : error);
        }

        _ = charge;
        var report = await ListFeeReportAsync(cancellationToken);
        var row = report.FirstOrDefault(r => r.EnvelopeId == envelopeId);
        return (row, null);
    }
}
