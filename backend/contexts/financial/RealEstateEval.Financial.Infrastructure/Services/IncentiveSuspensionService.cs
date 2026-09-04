using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed class IncentiveSuspensionService : IIncentiveSuspensionService
{
    private const int MaxListRows = 200;

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

    public Task<IReadOnlyList<IncentiveSuspensionDto>> ListAsync(
        string? transactionKey = null,
        string? assigneeId = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default) =>
        ListAsync(
            new IncentiveSuspensionListQuery
            {
                TransactionKey = transactionKey,
                AssigneeId = assigneeId,
                ActiveOnly = activeOnly,
            },
            cancellationToken);

    public async Task<IReadOnlyList<IncentiveSuspensionDto>> ListAsync(
        IncentiveSuspensionListQuery query,
        CancellationToken cancellationToken = default)
    {
        var rows = await Sorted(Filtered(query), query)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

 /// <summary>
 /// Filters and sorts in the database, then pages. Every filter is an EF predicate, so the page
 /// and TotalCount agree. See docs/architecture/pagination-contract.md §7.
 /// </summary>
    public async Task<PagedResultDto<IncentiveSuspensionDto>> ListPagedAsync(
        IncentiveSuspensionListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default)
    {
        var filtered = Filtered(query);
        var total = await filtered.CountAsync(cancellationToken);
        var rows = await Sorted(filtered, query)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        return new PagedResultDto<IncentiveSuspensionDto>
        {
            Items = rows.Select(ToDto).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = take,
        };
    }

    private IQueryable<IncentiveSuspension> Filtered(IncentiveSuspensionListQuery query)
    {
        var rows = _db.IncentiveSuspensions.AsNoTracking().AsQueryable();

        var transactionKey = FinancialLedgerListQueryRules.NormalizeExact(query.TransactionKey);
        if (transactionKey is not null)
            rows = rows.Where(x => x.TransactionKey == transactionKey);

        var assigneeId = FinancialLedgerListQueryRules.NormalizeExact(query.AssigneeId);
        if (assigneeId is not null)
            rows = rows.Where(x => x.AssigneeId == assigneeId);

        if (query.ActiveOnly)
            rows = rows.Where(x => x.LiftedAtUtc == null);

        var search = FinancialLedgerListQueryRules.NormalizeSearch(query.Q);
        if (search is not null)
        {
            rows = rows.Where(x =>
                x.TransactionKey.Contains(search)
                || x.AssigneeId.Contains(search)
                || x.Reason.Contains(search));
        }

        return rows;
    }

 /// <summary>Allow-listed sort plus the id tiebreaker so consecutive pages never overlap.</summary>
    private static IQueryable<IncentiveSuspension> Sorted(
        IQueryable<IncentiveSuspension> rows,
        IncentiveSuspensionListQuery query)
    {
        var descending = FinancialLedgerListQueryRules.ResolveDescending(query.Dir);
        IOrderedQueryable<IncentiveSuspension> ordered =
            FinancialLedgerListQueryRules.ResolveSort(query.Sort)
                == FinancialLedgerListSortKey.TransactionKey
                ? descending
                    ? rows.OrderByDescending(x => x.TransactionKey)
                    : rows.OrderBy(x => x.TransactionKey)
                : descending
                    ? rows.OrderByDescending(x => x.CreatedAtUtc)
                    : rows.OrderBy(x => x.CreatedAtUtc);

        return ordered.ThenBy(x => x.Id);
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
