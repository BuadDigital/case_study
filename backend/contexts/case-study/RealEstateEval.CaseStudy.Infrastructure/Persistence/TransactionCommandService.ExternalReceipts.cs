using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// «إضافة استلام من طرف خارجي» (Omar 2026-11-08): what the transaction waits for from outside the system.
/// A pending delivery shows the transaction «بانتظار طرف خارجي» and holds «إرسال المعاملة للدراسة».
/// </summary>
public sealed partial class TransactionCommandService
{
    public const string ExternalPartyRequiredAr = "اكتب اسم الطرف الخارجي وما ننتظره منه";
    public const string ExternalAfterSendAr = "أُرسلت المعاملة للدراسة — لا يُضاف استلام خارجي بعدها";
    public const string ExternalNotPendingAr = "هذا الاستلام لم يعد قيد الانتظار";
    private const int MaxPartyName = 200;
    private const int MaxAwaited = 500;
    private const int MaxNote = 1000;

    /// <summary>The deed's transaction's external deliveries, oldest first; null when the deed has no transaction.</summary>
    public async Task<IReadOnlyList<TransactionExternalReceiptDto>?> ListExternalReceiptsAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var transactionId = await TransactionIdOfAsync(propertyId, cancellationToken);
        if (transactionId is not Guid id) return null;
        var rows = await _db.TransactionExternalReceipts.AsNoTracking()
            .Where(r => r.TransactionId == id)
            .OrderBy(r => r.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    /// <summary>Records a delivery awaited from outside the system.</summary>
    /// <remarks>
    /// How it works: the coordination sub-role, the section supervisor or the CDO; the party and what is
    /// awaited are required (trimmed, capped); refused once the transaction is sent to the study; a
    /// timeline row on every deed. Edge cases: a deed with no transaction → «المعاملة غير موجودة».
    /// </remarks>
    public async Task<(TransactionExternalReceiptDto? Result, string? Error)> AddExternalReceiptAsync(
        Guid propertyId,
        AddTransactionExternalReceiptRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanFormallyReceive(StaffActor.From(actor)))
            return (null, FormalReceiptRules.RoleDeniedAr);
        var party = Cap(request.PartyName, MaxPartyName);
        var awaited = Cap(request.Awaited, MaxAwaited);
        if (party.Length == 0 || awaited.Length == 0) return (null, ExternalPartyRequiredAr);

        var transactionId = await TransactionIdOfAsync(propertyId, cancellationToken);
        if (transactionId is not Guid id) return (null, NotFoundAr);
        var transaction = await LoadTrackedAsync(id, cancellationToken);
        if (transaction is null) return (null, NotFoundAr);
        if (transaction.IsReceived) return (null, ExternalAfterSendAr);

        var now = _time.UtcNow();
        var row = new TransactionExternalReceipt
        {
            Id = Guid.NewGuid(),
            TransactionId = id,
            PartyName = party,
            Awaited = awaited,
            CreatedAtUtc = now,
            CreatedByUserId = actor?.UserId,
            CreatedByName = actor?.DisplayName?.Trim(),
        };
        _db.TransactionExternalReceipts.Add(row);
        await _db.SaveChangesAsync(cancellationToken);
        await RecordOnDeedsAsync(
            transaction,
            $"external:{row.Id:N}:added",
            "بانتظار طرف خارجي",
            $"{party} — {awaited}",
            PropertyTimelineTones.Warn,
            now,
            cancellationToken);
        return (ToDto(row), null);
    }

    /// <summary>Closes an external delivery: received («تم الاستلام») or dropped.</summary>
    /// <remarks>
    /// How it works: same roles as adding; only a pending row moves; a timeline row on every deed.
    /// Edge cases: an unknown id → no result and no error (404); a closed row → «لم يعد قيد الانتظار».
    /// </remarks>
    public async Task<(TransactionExternalReceiptDto? Result, string? Error)> CloseExternalReceiptAsync(
        Guid receiptId,
        bool received,
        CloseTransactionExternalReceiptRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanFormallyReceive(StaffActor.From(actor)))
            return (null, FormalReceiptRules.RoleDeniedAr);
        var row = await _db.TransactionExternalReceipts.FirstOrDefaultAsync(r => r.Id == receiptId, cancellationToken);
        if (row is null) return (null, null);
        var now = _time.UtcNow();
        var note = Cap(request.Note, MaxNote);
        var changed = received
            ? row.MarkReceived(actor?.UserId, actor?.DisplayName, note, now)
            : row.Cancel(note, now);
        if (!changed) return (null, ExternalNotPendingAr);
        await _db.SaveChangesAsync(cancellationToken);

        var transaction = await LoadTrackedAsync(row.TransactionId, cancellationToken);
        if (transaction is not null)
        {
            await RecordOnDeedsAsync(
                transaction,
                $"external:{row.Id:N}:{row.Status}",
                received ? "استلام من طرف خارجي" : "إلغاء انتظار طرف خارجي",
                $"{row.PartyName} — {row.Awaited}",
                received ? PropertyTimelineTones.Done : PropertyTimelineTones.Muted,
                now,
                cancellationToken);
        }
        return (ToDto(row), null);
    }

    private async Task<Guid?> TransactionIdOfAsync(Guid propertyId, CancellationToken cancellationToken) =>
        await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => (Guid?)p.TransactionId)
            .FirstOrDefaultAsync(cancellationToken);

    private async Task RecordOnDeedsAsync(
        Transaction transaction,
        string eventKey,
        string title,
        string detail,
        string tone,
        DateTime now,
        CancellationToken cancellationToken)
    {
        foreach (var deed in transaction.Properties.Where(d => !d.IsRemoved && d.WorkOrder is not null))
        {
            await _timeline.RecordAsync(
                deed.WorkOrder!.PoNumber,
                deed.Id,
                eventKey,
                title,
                detail,
                tone,
                now,
                cancellationToken);
        }
    }

    private static string Cap(string? value, int max)
    {
        var text = (value ?? "").Trim();
        return text.Length > max ? text[..max] : text;
    }

    private static TransactionExternalReceiptDto ToDto(TransactionExternalReceipt row) => new()
    {
        Id = row.Id.ToString("D"),
        PartyName = row.PartyName,
        Awaited = row.Awaited,
        Status = row.Status,
        CreatedAtUtc = row.CreatedAtUtc.ToString("o"),
        CreatedByName = row.CreatedByName,
        ReceivedAtUtc = row.ReceivedAtUtc?.ToString("o"),
        ReceivedByName = row.ReceivedByName,
        Note = row.Note,
    };
}
