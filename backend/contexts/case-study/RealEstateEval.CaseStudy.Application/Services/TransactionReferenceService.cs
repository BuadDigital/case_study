using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Every deed gets its PR number at the first full save of its initial data; the property number
/// follows from its deeds (single → the deed's number, linked → root + «-L»); the first approved report
/// locks it, and PRC / PRV report numbers are derived from it (ruling 2026-11-08).
/// </summary>
public sealed class TransactionReferenceService : ITransactionReferenceService
{
    public const string PropertyNotFoundAr = "العقار غير موجود";

    private readonly ITransactionRepository _db;

    public TransactionReferenceService(ITransactionRepository db)
    {
        _db = db;
    }

    /// <summary>The deed's property number, locked now; numbers any live deed still without one first.</summary>
    /// <remarks>
    /// How it works: 1) loads the deed's transaction tracked; 2) draws a PR number for every live deed
    /// that has none (a safety net for deeds from before 2026-11-08 or saved only by autosave);
    /// 3) recomputes the property number (<see cref="Transaction.RefreshReference"/>); 4) locks it
    /// (<see cref="Transaction.LockReference"/>) and saves when anything changed.
    /// Edge cases: idempotent — a reopen or a later approval gets the same number back, never a new one
    /// (prod PO-067455 kept PR-26-00002 after a reopen 21 s later). The Enfaz handover calls it first so
    /// a handed-over deed always has its number. Unknown deed → (null, «العقار غير موجود»); a counter
    /// error → (null, reason) and nothing is saved.
    /// </remarks>
    public async Task<(string? Reference, string? Error)> ConfirmOfficialReferenceAsync(
        Guid propertyId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default)
    {
        var transaction = await _db.GetByPropertyAsync(propertyId, track: true, cancellationToken);
        if (transaction is null) return (null, PropertyNotFoundAr);

        var changed = false;
        foreach (var deed in transaction.Properties.Where(p => !p.IsRemoved && string.IsNullOrWhiteSpace(p.ReferenceNumber)))
        {
            var (number, error) = await _db.AllocateOfficialReferenceAsync(nowUtc, cancellationToken);
            if (error is not null || string.IsNullOrWhiteSpace(number)) return (null, error ?? "تعذّر تخصيص رقم المعاملة.");
            deed.ReferenceNumber = number.Trim();
            deed.UpdatedAtUtc = nowUtc;
            changed = true;
        }

        changed |= transaction.RefreshReference(nowUtc);
        if (string.IsNullOrWhiteSpace(transaction.ReferenceNumber)) return (null, "تعذّر تحديد رقم العقار.");
        changed |= transaction.LockReference(nowUtc);
        if (changed) await _db.SaveChangesAsync(cancellationToken);
        return (transaction.ReferenceNumber, null);
    }

    public const string UnknownReviewStateAr = "حالة المراجعة غير معروفة";

    /// <summary>Moves the deed's transaction between the study and review (Omar 2026-11-05).</summary>
    /// <remarks>
    /// How it works: parses study | handed | approved, loads the deed's transaction tracked, applies
    /// <see cref="Transaction.SetReviewState"/> and saves when it changed; returns the state after the move.
    /// Edge cases: an unknown state → «حالة المراجعة غير معروفة»; an unknown deed → «العقار غير موجود»;
    /// a repeated move is a no-op (retries from Valuation are harmless).
    /// </remarks>
    public async Task<(string? State, string? Error)> SetReviewStateAsync(
        Guid propertyId,
        string state,
        string? userId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default)
    {
        if (TransactionReviewStates.Parse(state) is not { } parsed) return (null, UnknownReviewStateAr);
        var transaction = await _db.GetByPropertyAsync(propertyId, track: true, cancellationToken);
        if (transaction is null) return (null, PropertyNotFoundAr);
        if (transaction.SetReviewState(parsed, userId, nowUtc))
            await _db.SaveChangesAsync(cancellationToken);
        return (TransactionReviewStates.Of(transaction), null);
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
    /// from the property number (<see cref="ReferenceNumbering.Derive"/>, «-L» kept); DeedCount counts
    /// the loaded deeds. Edge cases: before any deed is numbered both report numbers are null; an old
    /// row's TMP never yields a report number.
    /// </remarks>
    public static TransactionDto ToDto(Transaction t) => new()
    {
        Id = t.Id,
        ReferenceNumber = t.ReferenceNumber,
        DisplayNumber = t.DisplayNumber,
        ConfirmedAtUtc = t.ConfirmedAtUtc?.ToString("o"),
        CaseStudyReportNumber = ReferenceNumbering.CaseStudyReportNumber(t.ReferenceNumber),
        ValuationReportNumber = ReferenceNumbering.ValuationReportNumber(t.ReferenceNumber),
        LinkKind = t.LinkKind,
        LinkKindLabelAr = TransactionLinkKinds.LabelAr(t.LinkKind),
        LinkReason = t.LinkReason,
        DeedCount = t.Properties.Count,
        ReviewState = TransactionReviewStates.Of(t),
    };
}
