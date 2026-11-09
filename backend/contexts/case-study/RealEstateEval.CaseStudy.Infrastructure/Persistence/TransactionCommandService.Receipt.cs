using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
/// The coordination → study boundary (ruling 2026-11-02): the formal receipt, and the
/// «يعمل عليها الآن» marker of the shared queues.
/// </summary>
public sealed partial class TransactionCommandService
{
    /// <summary>
    /// «إرسال المعاملة للدراسة»: coordination received every field party's work on every deed of the
    /// property's transaction (Omar 2026-11-08: submitted and accepted), every external delivery and
    /// every linked task; the transaction then sits in the shared «دراسة العقار» queue.
    /// </summary>
    /// <remarks>
    /// How it works: 1) the coordination sub-role, the section supervisor or the CDO only;
    /// 2) loads the deed's transaction with its deeds; 3) the holder deed's case-study task must be in
    /// the case-study phase; 4) reads every deed's inspection / survey tasks with their package status
    /// and acceptance, the transaction's pending external deliveries and — over the Operations API —
    /// the open tasks linked to its deeds, and asks <see cref="FormalReceiptRules.MissingAr"/>;
    /// 5) stamps the receipt, writes a timeline row on every deed and an audit row, and tells the study
    /// sub-role. An unreadable Operations API refuses («تعذّر التحقق من المهام المرتبطة»).
    /// Edge cases: a second receipt is refused with «أُرسلت المعاملة للدراسة من قبل»; a deed with no
    /// transaction (older rows) answers «المعاملة غير موجودة»; notices are best effort.
    /// </remarks>
    public async Task<(TransactionReceiptDto? Result, string? Error)> ReceiveAsync(
        Guid propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanFormallyReceive(StaffActor.From(actor)))
            return (null, FormalReceiptRules.RoleDeniedAr);

        var transactionId = await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => (Guid?)p.TransactionId)
            .FirstOrDefaultAsync(cancellationToken);
        if (transactionId is not Guid id) return (null, NotFoundAr);
        var transaction = await LoadTrackedAsync(id, cancellationToken);
        if (transaction is null) return (null, NotFoundAr);
        if (transaction.IsReceived) return (null, FormalReceiptRules.AlreadyReceivedAr);

        var deeds = transaction.Properties.Where(p => !p.IsRemoved).ToList();
        var deedIds = deeds.Select(d => d.Id).ToList();
        var tasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PropertyId != null && deedIds.Contains(t.PropertyId.Value))
            .ToListAsync(cancellationToken);

        var holder = TransactionStudyRules.Holder(transaction);
        var holderParent = tasks.FirstOrDefault(t =>
            t.Kind == WorkflowTaskKind.CaseStudyProperty && t.PropertyId == holder?.Id);
        if (holderParent is null || holderParent.Phase != WorkflowTaskPhase.CaseStudy)
            return (null, FormalReceiptRules.NotInCaseStudyAr);

        var partyTaskIds = tasks
            .Where(t => t.Kind is WorkflowTaskKind.FieldInspection or WorkflowTaskKind.EngineeringSurvey)
            .Select(t => t.Id)
            .ToList();
        var submissions = await _db.PartyTaskSubmissions.AsNoTracking()
            .Where(s => partyTaskIds.Contains(s.WorkflowTaskId))
            .Select(s => new { s.WorkflowTaskId, s.Status, s.AcceptedAtUtc })
            .ToListAsync(cancellationToken);
        var labelById = deeds.ToDictionary(d => d.Id, DeedLabel);
        var parties = tasks
            .Where(t => t.Kind is WorkflowTaskKind.FieldInspection or WorkflowTaskKind.EngineeringSurvey)
            .Select(t =>
            {
                var submission = submissions.FirstOrDefault(s => s.WorkflowTaskId == t.Id);
                return new ReceiptPartyFacts(
                    labelById.GetValueOrDefault(t.PropertyId!.Value, ""),
                    t.Kind,
                    t.Status,
                    submission?.Status,
                    submission?.AcceptedAtUtc is not null);
            })
            .ToList();
        var pendingExternal = await _db.TransactionExternalReceipts.AsNoTracking()
            .Where(r => r.TransactionId == transaction.Id && r.Status == TransactionExternalReceiptStatuses.Pending)
            .OrderBy(r => r.CreatedAtUtc)
            .Select(r => r.PartyName + " — " + r.Awaited)
            .ToListAsync(cancellationToken);
        var (linked, linkedError) = await OpenLinkedTasksAsync(deeds, cancellationToken);
        if (linkedError is not null) return (null, linkedError);
        var missing = FormalReceiptRules.MissingAr(labelById.Values.ToList(), parties, pendingExternal, linked);
        if (missing.Count > 0) return (null, string.Join(" ", missing));

        var now = _time.UtcNow();
        var actorName = actor?.DisplayName?.Trim();
        transaction.MarkReceived(actor?.UserId, actorName, now);
        await _db.SaveChangesAsync(cancellationToken);

        foreach (var deed in deeds.Where(d => d.WorkOrder is not null))
        {
            await _timeline.RecordAsync(
                deed.WorkOrder!.PoNumber,
                deed.Id,
                $"transaction:{transaction.Id}:received",
                "إرسال المعاملة للدراسة",
                string.IsNullOrWhiteSpace(actorName)
                    ? "انتقلت المعاملة إلى دراسة العقار"
                    : $"{actorName} — انتقلت المعاملة إلى دراسة العقار",
                PropertyTimelineTones.Done,
                now,
                cancellationToken);
        }

        if (_audit is not null && _auditLog is not null)
        {
            await _auditLog.AppendAsync(_audit.Create(
                actorId: string.IsNullOrWhiteSpace(actor?.UserId) ? "unknown" : actor.UserId,
                action: "case-study.transaction.received",
                entityType: "Transaction",
                entityId: transaction.Id.ToString("D"),
                before: new { received = false },
                after: new { received = true, actorName, actorSubRoles = actor?.SubRoles ?? [] }),
                cancellationToken);
        }

        await NotifyStudyOnReceiptAsync(transaction, holderParent, cancellationToken);
        return (new TransactionReceiptDto
        {
            Received = true,
            ReceivedAtUtc = transaction.ReceivedAtUtc?.ToString("o"),
            ReceivedByName = transaction.ReceivedByName,
        }, null);
    }

    /// <summary>
    /// «يعمل عليها الآن»: records that this specialist opened or saved the transaction. Information
    /// only — nothing is ever locked.
    /// </summary>
    /// <remarks>
    /// How it works: upserts the transaction's single marker row with the caller and the time.
    /// Edge cases: non-staff callers and unknown transactions are ignored (no error, the client fires
    /// it in the background); a concurrent upsert from another tab simply wins.
    /// </remarks>
    public async Task MarkWorkingAsync(
        Guid transactionId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        if (actor is null || !StaffActor.From(actor).IsCaseSpecialist) return;
        if (!await _db.Transactions.AnyAsync(t => t.Id == transactionId, cancellationToken)) return;

        var now = _time.UtcNow();
        var marker = await _db.TransactionWorkMarkers.FirstOrDefaultAsync(
            m => m.TransactionId == transactionId,
            cancellationToken);
        if (marker is null)
        {
            _db.TransactionWorkMarkers.Add(new TransactionWorkMarker
            {
                TransactionId = transactionId,
                UserId = actor.UserId,
                DisplayName = actor.DisplayName?.Trim() ?? "",
                AtUtc = now,
            });
        }
        else
        {
            marker.UserId = actor.UserId;
            marker.DisplayName = actor.DisplayName?.Trim() ?? "";
            marker.AtUtc = now;
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Two tabs inserted the first marker at once: the other one stands, which is fine.
        }
    }

    /// <summary>
    /// Changes how the deeds of a transaction are linked («مبنى واحد» / «أعيان بعقد») — the study may
    /// correct the kind coordination chose at the merge (ruling 2026-11-02).
    /// </summary>
    /// <remarks>
    /// How it works: the stage owner (<see cref="PoRoleMatrixRules.CanMergeAtStage"/>), a valid kind
    /// and a reason; stores kind + reason, writes a timeline row on every deed and an audit row.
    /// Edge cases: a single-deed transaction has no link kind; once the first report is approved (the
    /// number locked) the kind is fixed like the merge itself; the same kind again is a no-op that still
    /// answers the detail.
    /// </remarks>
    public async Task<(TransactionDetailDto? Result, string? Error)> ChangeLinkKindAsync(
        Guid transactionId,
        ChangeTransactionLinkKindRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var staff = StaffActor.From(actor);
        if (!PoRoleMatrixRules.CanMergeTransactions(staff)) return (null, RoleDeniedAr);
        var kind = (request.LinkKind ?? "").Trim();
        if (TransactionMergeRules.ValidateLinkKind(kind) is { } kindError) return (null, kindError);
        var reason = (request.Reason ?? "").Trim();
        if (TransactionMergeRules.ValidateReason(reason) is { } reasonError) return (null, reasonError);

        var transaction = await LoadTrackedAsync(transactionId, cancellationToken);
        if (transaction is null) return (null, NotFoundAr);
        if (!PoRoleMatrixRules.CanMergeAtStage(staff, transaction.IsReceived))
            return (null, StageDeniedAr(transaction.IsReceived));
        var deeds = transaction.Properties.Where(p => !p.IsRemoved).ToList();
        if (deeds.Count < 2) return (null, "نوع الربط للعقار المرتبط فقط");
        if (transaction.IsConfirmed) return (null, "اعتُمد تقرير للعقار — لا يتغير نوع الربط بعد اعتماد أول تقرير");

        if (transaction.LinkKind != kind)
        {
            var before = transaction.LinkKind;
            var now = _time.UtcNow();
            transaction.LinkKind = kind;
            transaction.LinkReason = reason;
            transaction.UpdatedAtUtc = now;
            await _db.SaveChangesAsync(cancellationToken);
            var actorName = actor?.DisplayName?.Trim();
            foreach (var deed in deeds.Where(d => d.WorkOrder is not null))
            {
                await _timeline.RecordAsync(
                    deed.WorkOrder!.PoNumber,
                    deed.Id,
                    $"transaction:{transaction.Id}:link-kind:{now:O}",
                    $"تغيير نوع الربط إلى {TransactionLinkKinds.LabelAr(kind)}",
                    string.IsNullOrWhiteSpace(actorName) ? reason : $"{actorName} — {reason}",
                    PropertyTimelineTones.Active,
                    now,
                    cancellationToken);
            }

            if (_audit is not null && _auditLog is not null)
            {
                await _auditLog.AppendAsync(_audit.Create(
                    actorId: string.IsNullOrWhiteSpace(actor?.UserId) ? "unknown" : actor.UserId,
                    action: "case-study.transaction.link-kind-changed",
                    entityType: "Transaction",
                    entityId: transaction.Id.ToString("D"),
                    before: new { linkKind = before },
                    after: new { linkKind = kind, reason }),
                    cancellationToken);
            }
        }

        return (await _query.GetAsync(transaction.Id, actor, cancellationToken), null);
    }

    private async Task NotifyStudyOnReceiptAsync(
        Transaction transaction,
        WorkflowTask holderParent,
        CancellationToken cancellationToken)
    {
        if (_notifications is null || _recipients is null) return;
        try
        {
            var userIds = await _recipients.ResolveCaseSpecialistUserIdsAsync(
                CaseSpecialistSubRoles.Study,
                cancellationToken);
            if (userIds.Count == 0) return;
            await _notifications.CreateForUsersAsync(
                userIds,
                new CreateUserNotificationRequest
                {
                    Title = "معاملة جاهزة لدراسة العقار",
                    Body = $"أُرسلت المعاملة {transaction.DisplayNumber} للدراسة — تنتظر دارس العقار.",
                    Tone = NotificationContract.Tones.Info,
                    Href = $"/case-study/{Uri.EscapeDataString(holderParent.Id.ToString())}",
                    Category = NotificationContract.Categories.Workflow,
                    EntityType = NotificationContract.EntityTypes.Task,
                    EntityId = holderParent.Id.ToString(),
                    SourceEvent = $"transaction-received:{transaction.Id}",
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Receipt notice failed for transaction {TransactionId}", transaction.Id);
        }
    }

    /// <summary>
    /// The operations tasks linked to the transaction's deeds that still hold it, as «رقم — عنوان» lines.
    /// </summary>
    /// <remarks>
    /// How it works: per work order of the deeds, asks <see cref="ILinkedOperationsTaskLookup"/> for its
    /// open tasks on those deed numbers. Edge cases: no lookup wired (tests, a host without
    /// Operations) → none; an unreachable API → the refusal message, never a silent pass.
    /// </remarks>
    private async Task<(IReadOnlyList<string> Lines, string? Error)> OpenLinkedTasksAsync(
        IReadOnlyCollection<WorkOrderProperty> deeds,
        CancellationToken cancellationToken)
    {
        if (_linkedTasks is null) return ([], null);
        var lines = new List<string>();
        try
        {
            foreach (var order in deeds.Where(d => d.WorkOrder is not null).GroupBy(d => d.WorkOrder!.PoNumber.Trim()))
            {
                var open = await _linkedTasks.ListOpenAsync(
                    order.Key,
                    order.Select(d => d.DeedNumber).ToList(),
                    cancellationToken);
                lines.AddRange(open.Select(t => $"{t.DisplayId} {t.Title}".Trim()));
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException or TaskCanceledException)
        {
            _logger?.LogWarning(ex, "Linked operations tasks unreadable before sending a transaction to the study.");
            return ([], FormalReceiptRules.LinkedTasksUnreadableAr);
        }
        return (lines, null);
    }
}
