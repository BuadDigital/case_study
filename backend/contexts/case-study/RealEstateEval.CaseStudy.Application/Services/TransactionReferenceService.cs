using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// A deed's transaction gets a TMP draft number at intake and its official PR
/// number only at the first approved report; PRC / PRV report numbers are derived from that PR root.
/// </summary>
public sealed class TransactionReferenceService : ITransactionReferenceService
{
    public const string PropertyNotFoundAr = "العقار غير موجود";

    private readonly ITransactionRepository _db;

    public TransactionReferenceService(ITransactionRepository db)
    {
        _db = db;
    }

    /// <summary>A new, unsaved draft transaction carrying the next TMP number.</summary>
    /// <remarks>
    /// How it works: draws the next yearly TMP-{YY}-{seq} from the repository's counter, then builds
    /// the row with <see cref="Transaction.CreateDraft"/>; the caller's unit of work saves it.
    /// Edge cases: a counter error or an empty number returns (null, Arabic reason) instead of a row
    /// without a number. TMP replaced the old D prefix (2026-10-20); it is never printed.
    /// </remarks>
    public async Task<(Transaction? Transaction, string? Error)> CreateDraftAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken = default)
    {
        var (number, error) = await _db.AllocateDraftNumberAsync(nowUtc, cancellationToken);
        if (error is not null || string.IsNullOrWhiteSpace(number)) return (null, error ?? "تعذّر تخصيص رقم المسودة.");
        return (Transaction.CreateDraft(number, nowUtc), null);
    }

    /// <summary>The deed's official PR reference, drawn now when the transaction has none yet.</summary>
    /// <remarks>
    /// How it works: 1) loads the deed's transaction tracked; 2) returns its existing reference when
    /// already confirmed; 3) otherwise draws the next yearly PR-{YY}-{seq}, fixes it with
    /// <see cref="Transaction.Confirm"/> and saves.
    /// Edge cases: idempotent — the first approved report (study or valuation) draws it, a reopen or a
    /// later approval gets the same number back, never a new one (gap-free; prod PO-067455 kept
    /// PR-26-00002 after a reopen 21 s later). The Enfaz handover calls it first so a handed-over deed
    /// never carries TMP. Unknown deed → (null, «العقار غير موجود»); counter error → (null, reason).
    /// </remarks>
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

    /// <summary>The transaction as the API shows it.</summary>
    /// <remarks>
    /// How it works: copies the numbers and link fields, and derives the PRC / PRV report numbers
    /// from the PR root (<see cref="ReferenceNumbering.Derive"/>); DeedCount counts the loaded deeds.
    /// Edge cases: while the transaction only has its TMP number both report numbers are null — a
    /// report number is never made from a temporary number.
    /// </remarks>
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
