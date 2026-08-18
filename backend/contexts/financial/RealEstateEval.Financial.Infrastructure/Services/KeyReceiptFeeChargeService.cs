using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class KeyReceiptFeeChargeService : IKeyReceiptFeeChargeService
{
    private const int MaxListRows = 500;
    private readonly FinancialDbContext _financial;
    private readonly TimeProvider _time;

    public KeyReceiptFeeChargeService(FinancialDbContext financial, TimeProvider? time = null)
    {
        _financial = financial;
        _time = time ?? TimeProvider.System;
    }

    public async Task<IReadOnlyList<KeyReceiptFeeChargeDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _financial.KeyReceiptFeeCharges.AsNoTracking()
            .OrderByDescending(c => c.CreatedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);
        return rows.Select(Map).ToList();
    }

    public async Task DeleteForEnvelopeAsync(
        Guid envelopeId,
        CancellationToken cancellationToken = default)
    {
        var charges = await _financial.KeyReceiptFeeCharges
            .Where(c => c.EnvelopeId == envelopeId)
            .ToListAsync(cancellationToken);
        if (charges.Count == 0)
            return;

        _financial.KeyReceiptFeeCharges.RemoveRange(charges);
        await _financial.SaveChangesAsync(cancellationToken);
    }

    public async Task<(KeyReceiptFeeChargeDto? Charge, string? Error)> MarkCollectedAsync(
        Guid envelopeId,
        string? invoiceReference,
        CancellationToken cancellationToken = default)
    {
        var charge = await _financial.KeyReceiptFeeCharges
            .FirstOrDefaultAsync(c => c.EnvelopeId == envelopeId, cancellationToken);
        if (charge is null)
            return (null, "بند الأتعاب غير موجود لهذا الظرف");

        var now = _time.UtcNow();
        charge.CollectionStatus = KeyReceiptFeeStatuses.Collected;
        charge.CollectedAtUtc = now;
        charge.UpdatedAtUtc = now;
        if (!string.IsNullOrWhiteSpace(invoiceReference))
            charge.InvoiceReference = invoiceReference.Trim();

        await _financial.SaveChangesAsync(cancellationToken);
        return (Map(charge), null);
    }

    public async Task<IReadOnlyList<PoEnfazKeyRevenueLineDto>> ListKeyRevenueLinesAsync(
        IReadOnlyList<Guid> envelopeIds,
        CancellationToken cancellationToken = default)
    {
        if (envelopeIds.Count == 0)
            return [];

        var rows = await _financial.PoEnfazRevenueLines.AsNoTracking()
            .Where(l => l.KeyEntitlementEnvelopeId != null
                && envelopeIds.Contains(l.KeyEntitlementEnvelopeId.Value)
                && l.KeyFeeSar > 0)
            .ToListAsync(cancellationToken);

        return rows
            .Where(l => l.KeyEntitlementEnvelopeId.HasValue)
            .Select(l => new PoEnfazKeyRevenueLineDto
            {
                EnvelopeId = l.KeyEntitlementEnvelopeId!.Value,
                PoNumber = l.PoNumber,
                KeyFeeSar = l.KeyFeeSar,
                UpdatedAtUtc = l.UpdatedAtUtc,
            })
            .ToList();
    }

    public async Task<IReadOnlyDictionary<string, PoEnfazInvoiceRefDto>> GetInvoicesByPoAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default)
    {
        if (poNumbers.Count == 0)
            return new Dictionary<string, PoEnfazInvoiceRefDto>(StringComparer.Ordinal);

        var rows = await _financial.PoEnfazInvoices.AsNoTracking()
            .Where(i => poNumbers.Contains(i.PoNumber))
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(
            i => i.PoNumber.Trim(),
            i => new PoEnfazInvoiceRefDto
            {
                PoNumber = i.PoNumber,
                Status = i.Status,
                InvoiceNumber = i.InvoiceNumber,
                CollectedAtUtc = i.CollectedAtUtc,
            },
            StringComparer.Ordinal);
    }

    private static KeyReceiptFeeChargeDto Map(KeyReceiptFeeCharge c) => new()
    {
        Id = c.Id,
        EnvelopeId = c.EnvelopeId,
        RequestNumber = c.RequestNumber,
        AmountSar = c.AmountSar,
        CollectionStatus = c.CollectionStatus,
        PhotoAttachmentId = c.PhotoAttachmentId,
        ReceiptAttachmentId = c.ReceiptAttachmentId,
        InvoiceReference = c.InvoiceReference,
        CollectedAtUtc = c.CollectedAtUtc,
        CreatedByName = c.CreatedByName,
        CreatedAtUtc = c.CreatedAtUtc,
    };
}
