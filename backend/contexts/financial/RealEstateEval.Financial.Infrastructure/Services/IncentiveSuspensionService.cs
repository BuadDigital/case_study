using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed class IncentiveSuspensionService : IIncentiveSuspensionService
{
    private readonly FinancialDbContext _db;
    private readonly IIdentityDirectory _identity;
    private readonly TimeProvider _time;

    // A8: the IdentityDbContext convenience ctor is gone — pass IIdentityDirectory.

    [ActivatorUtilitiesConstructor]
    public IncentiveSuspensionService(FinancialDbContext db, IIdentityDirectory identity,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _identity = identity;
    }

    public async Task<IReadOnlyList<IncentiveSuspensionDto>> ListAsync(
        string? transactionKey = null,
        string? assigneeId = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var query = _db.IncentiveSuspensions.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(transactionKey))
            query = query.Where(x => x.TransactionKey == transactionKey.Trim());
        if (!string.IsNullOrWhiteSpace(assigneeId))
            query = query.Where(x => x.AssigneeId == assigneeId.Trim());
        if (activeOnly)
            query = query.Where(x => x.LiftedAtUtc == null);

        var rows = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(200)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<IncentiveSuspensionDto?> FindActiveAsync(
        string assigneeId,
        string transactionKey,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(assigneeId) || string.IsNullOrWhiteSpace(transactionKey))
            return null;

        var row = await _db.IncentiveSuspensions.AsNoTracking()
            .Where(x =>
                x.AssigneeId == assigneeId.Trim()
                && x.TransactionKey == transactionKey.Trim()
                && x.LiftedAtUtc == null)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? null : ToDto(row);
    }

    public async Task<(IncentiveSuspensionDto? Row, string? Error)> CreateAsync(
        CreateIncentiveSuspensionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var assigneeId = request.AssigneeId?.Trim() ?? "";
        var transactionKey = request.TransactionKey?.Trim() ?? "";
        var reason = request.Reason?.Trim() ?? "";
        if (string.IsNullOrEmpty(assigneeId))
            return (null, "معرّف الطرف مطلوب.");
        if (string.IsNullOrEmpty(transactionKey))
            return (null, "رقم أمر العمل مطلوب.");
        if (string.IsNullOrEmpty(reason))
            return (null, "سبب إيقاف الحوافز مطلوب.");

        var profile = await _identity.GetCompensationByAssigneeAsync(assigneeId, cancellationToken);
        if (profile is null)
            return (null, "الطرف غير موجود.");
        if (!profile.HasCompensation)
            return (null, "هذا الطرف بلا حوافز مفعّلة.");

        var existing = await _db.IncentiveSuspensions
            .FirstOrDefaultAsync(
                x => x.AssigneeId == assigneeId
                    && x.TransactionKey == transactionKey
                    && x.LiftedAtUtc == null,
                cancellationToken);
        if (existing is not null)
            return (null, "يوجد إيقاف حوافز فعّال على هذه المعاملة لهذا الطرف.");

        var now = _time.UtcNow();
        var row = new IncentiveSuspension
        {
            Id = Guid.NewGuid(),
            UserId = profile.UserId,
            AssigneeId = assigneeId,
            TransactionKey = transactionKey,
            Reason = reason,
            CreatedByUserId = actorUserId,
            CreatedAtUtc = now,
        };
        _db.IncentiveSuspensions.Add(row);

 // Existing ledgers for this assignee+PO that are still suspendable move to suspended so
 // the withhold is not only prospective.
        var ledgers = await _db.InspectorFeeLedgers
            .Where(l =>
                l.AssigneeId == assigneeId
                && l.PoNumber == transactionKey
                && (l.BillingStatus == InspectorFeeBillingStatus.Draft
                    || l.BillingStatus == InspectorFeeBillingStatus.SupReview
                    || l.BillingStatus == InspectorFeeBillingStatus.AtFinance
                    || l.BillingStatus == InspectorFeeBillingStatus.Deferred
                    || l.BillingStatus == InspectorFeeBillingStatus.Returned
                    || l.BillingStatus == InspectorFeeBillingStatus.Inquiry))
            .ToListAsync(cancellationToken);
        foreach (var ledger in ledgers)
        {
            var from = ledger.BillingStatus;
            ledger.PreSuspensionStatus = from;
            ledger.SuspensionReason = reason;
            ledger.BillingStatus = InspectorFeeBillingStatus.Suspended;
            ledger.UpdatedAtUtc = now;
            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = from,
                ToStatus = InspectorFeeBillingStatus.Suspended,
                Reason = reason,
                ActorUserId = actorUserId,
                CreatedAtUtc = now,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (ToDto(row), null);
    }

    public async Task<(IncentiveSuspensionDto? Row, string? Error)> LiftAsync(
        Guid id,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.IncentiveSuspensions
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null)
            return (null, "سجل الإيقاف غير موجود.");
        if (row.LiftedAtUtc is not null)
            return (null, "تم رفع هذا الإيقاف مسبقاً.");

        var now = _time.UtcNow();
        row.LiftedAtUtc = now;
        row.LiftedByUserId = actorUserId;

        var ledgers = await _db.InspectorFeeLedgers
            .Where(l =>
                l.AssigneeId == row.AssigneeId
                && l.PoNumber == row.TransactionKey
                && l.BillingStatus == InspectorFeeBillingStatus.Suspended)
            .ToListAsync(cancellationToken);
        foreach (var ledger in ledgers)
        {
            var from = ledger.BillingStatus;
            var next = InspectorFeeBillingStatus.Suspendable.Contains(ledger.PreSuspensionStatus ?? "")
                ? ledger.PreSuspensionStatus!
                : InspectorFeeBillingStatus.Draft;
            ledger.BillingStatus = next;
            ledger.PreSuspensionStatus = null;
            ledger.SuspensionReason = null;
            ledger.UpdatedAtUtc = now;
            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = from,
                ToStatus = next,
                Reason = "رفع إيقاف الحوافز على المعاملة",
                ActorUserId = actorUserId,
                CreatedAtUtc = now,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (ToDto(row), null);
    }

    private static IncentiveSuspensionDto ToDto(IncentiveSuspension row) => new()
    {
        Id = row.Id.ToString(),
        UserId = row.UserId,
        AssigneeId = row.AssigneeId,
        TransactionKey = row.TransactionKey,
        Reason = row.Reason,
        IsActive = row.IsActive,
        CreatedAtUtc = row.CreatedAtUtc,
        LiftedAtUtc = row.LiftedAtUtc,
    };
}
