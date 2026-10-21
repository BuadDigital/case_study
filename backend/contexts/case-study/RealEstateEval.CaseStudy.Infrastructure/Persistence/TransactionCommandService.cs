using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// Merge / unmerge (decision 2026-10-19). The first transaction stays and keeps its number; the
/// others close as «مدمجة في …» and their deeds move over. Every move is written to the audit log
/// and to each deed's timeline. The study stays on the holder deed's task (phase 4) and the moved
/// deeds' valuation requests fold into the holder's (phase 5).
/// </summary>
public sealed class TransactionCommandService : ITransactionCommands
{
    public const string RoleDeniedAr = "دمج المعاملات وفكّها لأخصائي دراسة الحالة";
    public const string NotFoundAr = "المعاملة غير موجودة";
    private const int MaxSearchHits = 20;

    private readonly CaseStudyDbContext _db;
    private readonly ITransactionRepository _transactions;
    private readonly ITransactionQuery _query;
    private readonly IWorkOrderVisibilityFilter _visibility;
    private readonly IPropertyTimelineService _timeline;
    private readonly IAuditLogWriter? _audit;
    private readonly IAuditLogAppend? _auditLog;
    private readonly IValuationRequestFolding? _valuationFolding;
    private readonly ILogger<TransactionCommandService>? _logger;
    private readonly TimeProvider _time;

    public TransactionCommandService(
        CaseStudyDbContext db,
        ITransactionRepository transactions,
        ITransactionQuery query,
        IWorkOrderVisibilityFilter visibility,
        IPropertyTimelineService timeline,
        IAuditLogWriter? audit = null,
        IAuditLogAppend? auditLog = null,
        TimeProvider? time = null,
        IValuationRequestFolding? valuationFolding = null,
        ILogger<TransactionCommandService>? logger = null)
    {
        _db = db;
        _transactions = transactions;
        _query = query;
        _visibility = visibility;
        _timeline = timeline;
        _audit = audit;
        _auditLog = auditLog;
        _valuationFolding = valuationFolding;
        _logger = logger;
        _time = time ?? TimeProvider.System;
    }

    public async Task<(TransactionDetailDto? Result, string? Error)> MergeAsync(
        Guid targetTransactionId,
        MergeTransactionsRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanIssueCaseStudyReport(actor?.PrototypeRole))
            return (null, RoleDeniedAr);

        var reason = (request.Reason ?? "").Trim();
        if (TransactionMergeRules.ValidateReason(reason) is { } reasonError) return (null, reasonError);
        var linkKind = (request.LinkKind ?? "").Trim();
        if (TransactionMergeRules.ValidateLinkKind(linkKind) is { } kindError) return (null, kindError);
        var propertyIds = (request.PropertyIds ?? []).Distinct().ToList();
        if (propertyIds.Count == 0) return (null, TransactionMergeRules.NoDeedsAr);

        var target = await LoadTrackedAsync(targetTransactionId, cancellationToken);
        if (target is null) return (null, NotFoundAr);
        if (TransactionMergeRules.ValidateTarget(target, target.Properties) is { } targetError)
            return (null, targetError);

        var deeds = await _db.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .Where(p => propertyIds.Contains(p.Id))
            .ToListAsync(cancellationToken);
        if (deeds.Count != propertyIds.Count) return (null, "أحد الصكوك غير موجود");

        var sourceIds = deeds.Select(d => d.TransactionId).Distinct().ToList();
        var sources = await _db.Transactions
            .Include(t => t.Properties)
            .ThenInclude(p => p.WorkOrder)
            .Where(t => sourceIds.Contains(t.Id))
            .ToListAsync(cancellationToken);

        var allMoving = sources.SelectMany(s => s.Properties).Concat(deeds).DistinctBy(p => p.Id).ToList();

        foreach (var deed in deeds)
        {
            var source = sources.FirstOrDefault(s => s.Id == deed.TransactionId);
            var blocked = TransactionMergeRules.BlockedReason(deed, source, target.Id);
            if (blocked is not null) return (null, $"{DeedLabel(deed)}: {blocked}");
        }
        foreach (var deed in target.Properties.Where(p => !p.IsRemoved))
        {
            if (TransactionMergeRules.DeedStageBlock(deed) is { } blocked)
                return (null, $"{DeedLabel(deed)}: {blocked}");
        }
        // A source transaction brings all its deeds: every one of them must be mergeable too.
        foreach (var deed in allMoving.Where(p => !deeds.Any(d => d.Id == p.Id) && !p.IsRemoved))
        {
            if (TransactionMergeRules.DeedStageBlock(deed) is { } blocked)
                return (null, $"{DeedLabel(deed)}: {blocked}");
        }

        var now = _time.UtcNow();
        var actorId = ActorId(actor);
        var moved = new List<WorkOrderProperty>();
        foreach (var source in sources)
        {
            foreach (var deed in source.Properties.ToList())
            {
                deed.TransactionId = target.Id;
                deed.Transaction = target;
                target.Properties.Add(deed);
                moved.Add(deed);
            }
            source.Properties.Clear();
            source.MergedIntoTransactionId = target.Id;
            source.MergedAtUtc = now;
            source.MergedByUserId = actorId;
            source.UpdatedAtUtc = now;
        }

        target.LinkKind = linkKind;
        target.LinkReason = reason;
        // Phase 4: the one study stays with the target's own first deed, fixed now so a later
        // deed with an older work order never steals it.
        target.StudyHolderPropertyId ??= TransactionStudyRules.Holder(new Transaction
        {
            Id = target.Id,
            Properties = target.Properties.Where(p => !moved.Any(m => m.Id == p.Id)).ToList(),
        })?.Id;
        target.UpdatedAtUtc = now;
        await _db.SaveChangesAsync(cancellationToken);

        var targetLabel = target.DisplayNumber;
        var actorName = actor?.DisplayName?.Trim();
        foreach (var deed in moved)
        {
            await _timeline.RecordAsync(
                deed.WorkOrder!.PoNumber,
                deed.Id,
                $"transaction:{target.Id}:merged-in:{now:O}",
                $"ضُم الصك إلى المعاملة {targetLabel}",
                string.IsNullOrWhiteSpace(actorName) ? reason : $"{actorName} — {reason}",
                PropertyTimelineTones.Done,
                now,
                cancellationToken);
        }
        foreach (var deed in target.Properties.Where(p => !moved.Any(m => m.Id == p.Id) && p.WorkOrder is not null))
        {
            await _timeline.RecordAsync(
                deed.WorkOrder!.PoNumber,
                deed.Id,
                $"transaction:{target.Id}:merged:{now:O}",
                $"ضُمّت إلى المعاملة صكوك أخرى ({moved.Count}) — {TransactionLinkKinds.LabelAr(linkKind)}",
                string.IsNullOrWhiteSpace(actorName) ? reason : $"{actorName} — {reason}",
                PropertyTimelineTones.Done,
                now,
                cancellationToken);
        }

        await AuditAsync(actorId, "TRANSACTION_MERGED", target.Id, new
        {
            sources = sources.Select(s => new { s.Id, s.DraftNumber }).ToList(),
            deeds = moved.Select(d => d.Id).ToList(),
            linkKind,
            reason,
        }, cancellationToken);

        // Phase 5: one valuation per transaction — the moved deeds' open requests fold into the
        // holder's. Best effort after the merge committed; a failure is logged, the appraiser's
        // screens still route by the holder, and the next merge/unmerge repeats the call.
        if (target.StudyHolderPropertyId is Guid holderPropertyId)
        {
            await FoldValuationRequestsAsync(moved.Select(d => d.Id).ToList(), holderPropertyId, cancellationToken);
        }

        return (await _query.GetAsync(target.Id, actor, cancellationToken), null);
    }

    private async Task FoldValuationRequestsAsync(
        List<Guid> movedPropertyIds,
        Guid holderPropertyId,
        CancellationToken cancellationToken)
    {
        if (_valuationFolding is null || movedPropertyIds.Count == 0) return;
        try
        {
            await _valuationFolding.FoldAsync(
                new FoldValuationRequestsRequest { PropertyIds = movedPropertyIds, HolderPropertyId = holderPropertyId },
                cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger?.LogWarning(ex, "Transaction merge: folding the valuation requests of {Count} deeds failed", movedPropertyIds.Count);
        }
    }

    private async Task UnfoldValuationRequestAsync(Guid propertyId, CancellationToken cancellationToken)
    {
        if (_valuationFolding is null) return;
        try
        {
            await _valuationFolding.UnfoldAsync(new UnfoldValuationRequestRequest { PropertyId = propertyId }, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger?.LogWarning(ex, "Transaction unmerge: unfolding the valuation request of deed {PropertyId} failed", propertyId);
        }
    }

    public async Task<(TransactionDetailDto? Result, string? Error)> UnmergeDeedAsync(
        Guid transactionId,
        UnmergeTransactionDeedRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanIssueCaseStudyReport(actor?.PrototypeRole))
            return (null, RoleDeniedAr);
        var reason = (request.Reason ?? "").Trim();
        if (TransactionMergeRules.ValidateReason(reason) is { } reasonError) return (null, reasonError);

        var transaction = await LoadTrackedAsync(transactionId, cancellationToken);
        if (transaction is null) return (null, NotFoundAr);
        var deed = transaction.Properties.FirstOrDefault(p => p.Id == request.PropertyId);
        var liveCount = transaction.Properties.Count(p => !p.IsRemoved);
        if (TransactionMergeRules.ValidateUnmerge(transaction, deed, liveCount) is { } error)
            return (null, error);

        var now = _time.UtcNow();
        var (fresh, draftError) = await NewDraftAsync(now, cancellationToken);
        if (draftError is not null || fresh is null) return (null, draftError ?? "تعذّر فتح معاملة جديدة");

        transaction.Properties.Remove(deed!);
        deed!.TransactionId = fresh.Id;
        deed.Transaction = fresh;
        fresh.Properties.Add(deed);
        if (transaction.Properties.Count(p => !p.IsRemoved) < 2)
        {
            transaction.LinkKind = null;
            transaction.LinkReason = null;
        }
        transaction.UpdatedAtUtc = now;
        _db.Transactions.Add(fresh);
        await _db.SaveChangesAsync(cancellationToken);

        var actorId = ActorId(actor);
        var actorName = actor?.DisplayName?.Trim();
        if (deed.WorkOrder is not null)
        {
            await _timeline.RecordAsync(
                deed.WorkOrder.PoNumber,
                deed.Id,
                $"transaction:{fresh.Id}:unmerged:{now:O}",
                $"أُخرج الصك من المعاملة {transaction.DisplayNumber} إلى معاملة جديدة {fresh.DraftNumber}",
                string.IsNullOrWhiteSpace(actorName) ? reason : $"{actorName} — {reason}",
                PropertyTimelineTones.Warn,
                now,
                cancellationToken);
        }

        await AuditAsync(actorId, "TRANSACTION_DEED_UNMERGED", transaction.Id, new
        {
            propertyId = deed.Id,
            newTransactionId = fresh.Id,
            newDraftNumber = fresh.DraftNumber,
            reason,
        }, cancellationToken);

        await UnfoldValuationRequestAsync(deed.Id, cancellationToken);

        return (await _query.GetAsync(transaction.Id, actor, cancellationToken), null);
    }

    public async Task<IReadOnlyList<TransactionDeedSearchHitDto>> SearchDeedsAsync(
        Guid targetTransactionId,
        string query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var q = (query ?? "").Trim();
        if (q.Length < 3) return [];
        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);

        var rows = await _db.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .Include(p => p.Transaction)
            .Where(p => !p.IsRemoved && p.WorkOrder != null)
            .Where(p => p.DeedNumber.Contains(q)
                || (p.RealEstateRegNumber != null && p.RealEstateRegNumber.Contains(q))
                || p.WorkOrder!.PoNumber.Contains(q))
            .Where(p => visiblePos == null || visiblePos.Contains(p.WorkOrder!.PoNumber))
            .OrderByDescending(p => p.WorkOrder!.CreatedAtUtc)
            .Take(MaxSearchHits)
            .ToListAsync(cancellationToken);

        var transactionIds = rows.Select(r => r.TransactionId).Distinct().ToList();
        var deedCounts = await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => transactionIds.Contains(p.TransactionId) && !p.IsRemoved)
            .GroupBy(p => p.TransactionId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, cancellationToken);

        return rows.Select(p => new TransactionDeedSearchHitDto
        {
            PropertyId = p.Id,
            PoNumber = p.WorkOrder!.PoNumber,
            IdentifierType = PropertyIdentifierTypeLabels.ToApiValue(p.IdentifierType),
            DeedNumber = p.DeedNumber,
            RealEstateRegNumber = p.RealEstateRegNumber,
            City = p.City,
            District = p.District,
            OwnerName = p.OwnerName,
            TransactionId = p.TransactionId,
            TransactionNumber = p.Transaction?.DisplayNumber ?? "",
            TransactionDeedCount = deedCounts.GetValueOrDefault(p.TransactionId, 1),
            BlockedReasonAr = TransactionMergeRules.BlockedReason(p, p.Transaction, targetTransactionId),
        }).ToList();
    }

    private Task<Transaction?> LoadTrackedAsync(Guid id, CancellationToken cancellationToken) =>
        _db.Transactions
            .Include(t => t.Properties)
            .ThenInclude(p => p.WorkOrder)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    private async Task<(Transaction? Transaction, string? Error)> NewDraftAsync(DateTime now, CancellationToken cancellationToken)
    {
        var (number, error) = await _transactions.AllocateDraftNumberAsync(now, cancellationToken);
        if (error is not null || string.IsNullOrWhiteSpace(number)) return (null, error);
        return (Transaction.CreateDraft(number, now), null);
    }

    private async Task AuditAsync(string actorId, string action, Guid transactionId, object after, CancellationToken cancellationToken)
    {
        if (_audit is null || _auditLog is null) return;
        await _auditLog.AppendAsync(
            _audit.Create(actorId, action, "transaction", transactionId.ToString("D"), null, after),
            cancellationToken);
    }

    private static string ActorId(PermissionsDto? actor) =>
        string.IsNullOrWhiteSpace(actor?.UserId) ? "system" : actor!.UserId.Trim();

    private static string DeedLabel(WorkOrderProperty deed) =>
        $"صك {(string.IsNullOrWhiteSpace(deed.DeedNumber) ? deed.RealEstateRegNumber ?? "—" : deed.DeedNumber)}";
}
