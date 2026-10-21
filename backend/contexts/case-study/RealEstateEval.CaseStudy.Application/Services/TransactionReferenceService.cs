using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed class TransactionReferenceService : ITransactionReferenceService
{
    public const string PropertyNotFoundAr = "العقار غير موجود";

    private readonly ITransactionRepository _db;

    public TransactionReferenceService(ITransactionRepository db)
    {
        _db = db;
    }

    public async Task<(Transaction? Transaction, string? Error)> CreateDraftAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken = default)
    {
        var (number, error) = await _db.AllocateDraftNumberAsync(nowUtc, cancellationToken);
        if (error is not null || string.IsNullOrWhiteSpace(number)) return (null, error ?? "تعذّر تخصيص رقم المسودة.");
        return (Transaction.CreateDraft(number, nowUtc), null);
    }

    public async Task<(string? Reference, string? Error)> ConfirmOfficialReferenceAsync(
        Guid propertyId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default)
    {
        var transaction = await _db.GetByPropertyAsync(propertyId, track: true, cancellationToken);
        if (transaction is null) return (null, PropertyNotFoundAr);
        if (transaction.IsConfirmed) return (transaction.ReferenceNumber, null);

        var (reference, error) = await _db.AllocateOfficialReferenceAsync(nowUtc, cancellationToken);
        if (error is not null || string.IsNullOrWhiteSpace(reference)) return (null, error ?? "تعذّر تخصيص الرقم المرجعي.");

        transaction.Confirm(reference, nowUtc);
        await _db.SaveChangesAsync(cancellationToken);
        return (transaction.ReferenceNumber, null);
    }

    public async Task<TransactionDto?> GetForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var transaction = await _db.GetByPropertyAsync(propertyId, track: false, cancellationToken);
        return transaction is null ? null : ToDto(transaction);
    }

    public static TransactionDto ToDto(Transaction t) => new()
    {
        Id = t.Id,
        DraftNumber = t.DraftNumber,
        ReferenceNumber = t.ReferenceNumber,
        ConfirmedAtUtc = t.ConfirmedAtUtc?.ToString("o"),
        CaseStudyReportNumber = ReferenceNumbering.CaseStudyReportNumber(t.ReferenceNumber),
        ValuationReportNumber = ReferenceNumbering.ValuationReportNumber(t.ReferenceNumber),
        LinkKind = t.LinkKind,
        LinkKindLabelAr = TransactionLinkKinds.LabelAr(t.LinkKind),
        LinkReason = t.LinkReason,
        DeedCount = t.Properties.Count,
    };
}
