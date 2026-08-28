using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed class InspectorFeeLedgerWriter : IInspectorFeeLedgerWriter
{
    private readonly FinancialDbContext _financial;
    private readonly ICaseStudyLookup _lookup;
    private readonly IPartyFeePricingService _pricing;
    private readonly IInspectorFeeLedgerResolver _resolver;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public InspectorFeeLedgerWriter(
        FinancialDbContext financial,
        ICaseStudyLookup lookup,
        IPartyFeePricingService pricing,
        IInspectorFeeLedgerResolver resolver,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _financial = financial;
        _lookup = lookup;
        _pricing = pricing;
        _resolver = resolver;
    }


    public async Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default)
    {
 // Engineering-survey fees accrue only on specialist acceptance — not here.
        var feeTasks = tasks
            .Where(t => t.Kind is WorkflowTaskKind.FieldInspection
                or WorkflowTaskKind.GovernmentReview)
            .ToList();
        if (feeTasks.Count == 0) return;

        var now = _time.UtcNow();

 /* كانت الحلقة تصدر حتى ٥ نداءات لكل (مهمة × صك) — نوع الطرف والتعويض والرسم
    يعتمدون على مفاتيح تتكرر فتُحفَظ في قواميس، وهوية الدفتر تُحلّ مرة لكل مهمة
    (الـ DeedId وحده يتغير بين الصكوك)، وفحوص الوجود والتعليق تصير استعلامين. */
        var partyTypeCache = new Dictionary<(WorkflowTaskKind Kind, string AssigneeId), string>();
        var compensationCache = new Dictionary<string, bool>(StringComparer.Ordinal);
        var feeCache =
            new Dictionary<(WorkflowTaskKind, string, decimal?, string), ResolvedPartyFee>();
        var pendingTriples = new HashSet<(Guid TransactionId, Guid DeedId, string UserId)>();
        var candidates = new List<PendingLedgerCandidate>();

        foreach (var task in feeTasks)
        {
            var assigneeKey = task.AssigneeId?.Trim() ?? "";
            if (!partyTypeCache.TryGetValue((task.Kind, assigneeKey), out var partyType))
            {
                partyType = await _resolver.ResolvePartyTypeAsync(task, cancellationToken);
                partyTypeCache[(task.Kind, assigneeKey)] = partyType;
            }
            var isEmployee = InspectorFeeRules.IsEmployee(partyType);

 // Employee incentives require an active compensation flag and a resolved flat table.
 // Opening a zero draft for every employee was the hand-entry path replaces.
            if (isEmployee)
            {
                if (!compensationCache.TryGetValue(assigneeKey, out var hasCompensation))
                {
                    hasCompensation = await _resolver.AssigneeHasCompensationAsync(
                        task.AssigneeId,
                        cancellationToken);
                    compensationCache[assigneeKey] = hasCompensation;
                }
                if (!hasCompensation) continue;
            }

            var po = task.PoNumber.Trim();
            var deeds = await _resolver.ResolveDeedTargetsAsync(task, cancellationToken);
 // TransactionId/UserId لا يعتمدان على الصك؛ وDeedId المُمرَّر دوماً غير فارغ
 // فيساوي deed.DeedId حرفياً (صيغة ResolveLedgerIdentityAsync نفسها).
            var baseIdentity = await _resolver.ResolveLedgerIdentityAsync(
                task,
                cancellationToken);
            var ordinal = 0;
            foreach (var deed in deeds)
            {
                ordinal++;
                var areaM2 = await _resolver.ResolvePropertyAreaM2Async(
                    task, cancellationToken, deed.PropertyId);
                var feeKey = (task.Kind, partyType, areaM2, assigneeKey);
                if (!feeCache.TryGetValue(feeKey, out var agreedFee))
                {
                    agreedFee = await _pricing.ResolveDefaultFeeAsync(
                        task.Kind,
                        partyType,
                        areaM2,
                        task.AssigneeId,
                        cancellationToken);
                    feeCache[feeKey] = agreedFee;
                }

 // Unresolved means no rate yet — inventing zero here is exactly what we are removing.
                if (!agreedFee.IsResolved) continue;

 // same (transaction, deed, user) must not open a second line — even via another task.
                var tripleKey = (baseIdentity.TransactionId, deed.DeedId, baseIdentity.UserId);
                if (!pendingTriples.Add(tripleKey)) continue;

                candidates.Add(new PendingLedgerCandidate(
                    task, deed, ordinal, partyType, isEmployee, tripleKey, agreedFee, po));
            }
        }

 // استعلام وجود واحد لكل الدفعة بدل AnyAsync لكل صك.
        var existingTriples = new HashSet<(Guid, Guid, string)>();
        if (candidates.Count > 0)
        {
            var txIds = candidates
                .Select(c => c.Triple.TransactionId)
                .Distinct()
                .ToList();
            var existing = await _financial.InspectorFeeLedgers.AsNoTracking()
                .Where(x => txIds.Contains(x.TransactionId))
                .Select(x => new { x.TransactionId, x.DeedId, x.UserId })
                .ToListAsync(cancellationToken);
            foreach (var row in existing)
                existingTriples.Add((row.TransactionId, row.DeedId, row.UserId));
        }

 // استعلام تعليق واحد لكل أزواج (الموظف، المعاملة).
        var suspensionByPair = new Dictionary<(string Aid, string Po), string>();
        var employeePairs = candidates
            .Where(c => c.IsEmployee && !string.IsNullOrWhiteSpace(c.Task.AssigneeId))
            .Select(c => (Aid: c.Task.AssigneeId!.Trim(), c.Po))
            .Distinct()
            .ToList();
        if (employeePairs.Count > 0)
        {
            var aids = employeePairs.Select(p => p.Aid).Distinct().ToList();
            var pos = employeePairs.Select(p => p.Po).Distinct().ToList();
            var suspensions = await _financial.IncentiveSuspensions.AsNoTracking()
                .Where(x =>
                    aids.Contains(x.AssigneeId)
                    && pos.Contains(x.TransactionKey)
                    && x.LiftedAtUtc == null)
                .Select(x => new { x.AssigneeId, x.TransactionKey, x.Reason })
                .ToListAsync(cancellationToken);
            foreach (var s in suspensions)
                suspensionByPair.TryAdd((s.AssigneeId, s.TransactionKey), s.Reason);
        }

        foreach (var c in candidates)
        {
            if (existingTriples.Contains(c.Triple)) continue;

            var billingStatus = InspectorFeeBillingStatus.Draft;
            string? preSuspension = null;
            string? suspensionReason = null;
            if (c.IsEmployee
                && !string.IsNullOrWhiteSpace(c.Task.AssigneeId)
                && suspensionByPair.TryGetValue(
                    (c.Task.AssigneeId.Trim(), c.Po), out var withhold))
            {
                billingStatus = InspectorFeeBillingStatus.Suspended;
                preSuspension = InspectorFeeBillingStatus.Draft;
                suspensionReason = withhold;
            }

            _financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
            {
                Id = Guid.NewGuid(),
                TransactionId = c.Triple.TransactionId,
                DeedId = c.Triple.DeedId,
                UserId = c.Triple.UserId,
                WorkflowTaskId = c.Task.Id,
                PoNumber = c.Po,
                PropertyId = c.Deed.PropertyId,
                PropertyOrdinal = c.Deed.PropertyId == c.Task.PropertyId
                    ? c.Task.PropertyOrdinal
                    : c.Ordinal,
                AssigneeId = c.Task.AssigneeId,
                InspectorType = c.PartyType,
                SupervisingDepartment = SupervisingDepartments.ForTaskKind(c.Task.Kind),
                AgreedFeeSar = c.Fee.FeeSar!.Value,
                PricingTableId = c.Fee.PricingTableId,
                SupervisorDiscountSar = 0m,
                DiscountReason = null,
                BillingStatus = billingStatus,
                PreSuspensionStatus = preSuspension,
                SuspensionReason = suspensionReason,
                ExcludedFromBatch = false,
                ExclusionReason = null,
                ReturnTo = null,
                DisbursementBatchId = null,
                DisbursementVoucher = null,
                AccruedAtUtc = now,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await _financial.SaveChangesAsync(cancellationToken);
    }

    private sealed record PendingLedgerCandidate(
        WorkflowTask Task,
        InspectorFeeDeedTarget Deed,
        int Ordinal,
        string PartyType,
        bool IsEmployee,
        (Guid TransactionId, Guid DeedId, string UserId) Triple,
        ResolvedPartyFee Fee,
        string Po);

    public async Task BackfillMissingLedgersAsync(CancellationToken cancellationToken = default)
    {
 // Engineering-survey ledgers are created only via AccrueEngineeringSurveyFeeAsync.
        var feeTasks = (await _lookup.ListWorkflowTasksByKindsAsync(
                [WorkflowTaskKind.FieldInspection, WorkflowTaskKind.GovernmentReview],
                cancellationToken))
            .Select(s => s.ToWorkflowTask())
            .ToList();
        if (feeTasks.Count == 0) return;

        var readyPropertyIds = await _lookup.GetCompletedCaseStudyPropertyIdsAsync(
            feeTasks.Select(t => t.PropertyId),
            cancellationToken);

 // Property-linked tasks need completed case-study; PO-level tasks (null PropertyId) are
 // expanded per deed inside EnsureLedgersForTasksAsync.
        feeTasks = feeTasks
            .Where(t =>
                t.PropertyId is null
                || (t.PropertyId is Guid pid && readyPropertyIds.Contains(pid)))
            .ToList();
        if (feeTasks.Count == 0) return;

        await EnsureLedgersForTasksAsync(feeTasks, cancellationToken);
    }

 /* كان يجري داخل استعلام الملخص مع كل GET (تحميل كل الدفاتر + كل المهام وكتابة
    محتملة لكل استطلاع شاشة الأتعاب) — انتقل إلى حلقة الصيانة الخلفية. */
    public async Task SyncLedgerSnapshotsFromTasksAsync(CancellationToken cancellationToken = default)
    {
        var ledgers = await _financial.InspectorFeeLedgers.ToListAsync(cancellationToken);
        if (ledgers.Count == 0) return;

        var taskIds = ledgers.Select(l => l.WorkflowTaskId).Distinct().ToList();
        var taskSnapshots = await _lookup.ListWorkflowTasksByIdsAsync(taskIds, cancellationToken);
        var tasks = taskSnapshots.ToDictionary(t => t.Id, t => t.ToWorkflowTask());

        var anyChanged = false;
        var now = _time.UtcNow();
        foreach (var ledger in ledgers)
        {
            if (!tasks.TryGetValue(ledger.WorkflowTaskId, out var task))
                continue;

            var rowChanged = false;

            if (task.PropertyId is Guid propertyId && ledger.PropertyId != propertyId)
            {
                ledger.PropertyId = propertyId;
                rowChanged = true;
            }

            if (ledger.PropertyOrdinal != task.PropertyOrdinal)
            {
                ledger.PropertyOrdinal = task.PropertyOrdinal;
                rowChanged = true;
            }

            var taskAssignee = task.AssigneeId?.Trim();
            var ledgerAssignee = ledger.AssigneeId?.Trim();
            if (!string.Equals(taskAssignee, ledgerAssignee, StringComparison.Ordinal))
            {
                ledger.AssigneeId = string.IsNullOrEmpty(taskAssignee) ? null : taskAssignee;
                rowChanged = true;
            }

            if (!rowChanged) continue;

            ledger.UpdatedAtUtc = now;
            anyChanged = true;
        }

        if (anyChanged)
            await _financial.SaveChangesAsync(cancellationToken);
    }
}
