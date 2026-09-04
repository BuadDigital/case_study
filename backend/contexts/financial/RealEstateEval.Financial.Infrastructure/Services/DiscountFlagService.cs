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
using RealEstateEval.Financial.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed class DiscountFlagService : IDiscountFlagService
{
    private const int MaxListRows = 200;

    private readonly FinancialDbContext _db;
    private readonly ICaseStudyLookup _caseStudy;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public DiscountFlagService(FinancialDbContext db, ICaseStudyLookup caseStudy,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _caseStudy = caseStudy;
    }

    public Task<IReadOnlyList<DiscountFlagDto>> ListAsync(
        string? transactionKey = null,
        string? status = null,
        CancellationToken cancellationToken = default) =>
        ListAsync(
            new DiscountFlagListQuery { TransactionKey = transactionKey, Status = status },
            cancellationToken);

    public async Task<IReadOnlyList<DiscountFlagDto>> ListAsync(
        DiscountFlagListQuery query,
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
    public async Task<PagedResultDto<DiscountFlagDto>> ListPagedAsync(
        DiscountFlagListQuery query,
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

        return new PagedResultDto<DiscountFlagDto>
        {
            Items = rows.Select(ToDto).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = take,
        };
    }

    private IQueryable<DiscountFlag> Filtered(DiscountFlagListQuery query)
    {
        var rows = _db.DiscountFlags.AsNoTracking().AsQueryable();

        var transactionKey = FinancialLedgerListQueryRules.NormalizeExact(query.TransactionKey);
        if (transactionKey is not null)
            rows = rows.Where(x => x.TransactionKey == transactionKey);

        var status = FinancialLedgerListQueryRules.NormalizeExact(query.Status);
        if (status is not null)
            rows = rows.Where(x => x.Status == status);

        var search = FinancialLedgerListQueryRules.NormalizeSearch(query.Q);
        if (search is not null)
        {
            rows = rows.Where(x =>
                x.TransactionKey.Contains(search)
                || x.TargetAssigneeId.Contains(search)
                || x.Reason.Contains(search));
        }

        return rows;
    }

 /// <summary>Allow-listed sort plus the id tiebreaker so consecutive pages never overlap.</summary>
    private static IQueryable<DiscountFlag> Sorted(
        IQueryable<DiscountFlag> rows,
        DiscountFlagListQuery query)
    {
        var descending = FinancialLedgerListQueryRules.ResolveDescending(query.Dir);
        IOrderedQueryable<DiscountFlag> ordered =
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

    public async Task<(DiscountFlagDto? Row, string? Error)> CreateAsync(
        CreateDiscountFlagRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var transactionKey = request.TransactionKey?.Trim() ?? "";
        var target = request.TargetAssigneeId?.Trim() ?? "";
        var reason = request.Reason?.Trim() ?? "";
        if (string.IsNullOrEmpty(transactionKey))
            return (null, "رقم أمر العمل مطلوب.");
        if (string.IsNullOrEmpty(target))
            return (null, "الطرف المستهدف مطلوب.");
        if (string.IsNullOrEmpty(reason))
            return (null, "سبب وسم الخصم مطلوب.");
        if (request.ProposedDiscountSar <= 0m)
            return (null, "مبلغ الخصم المقترح يجب أن يكون أكبر من صفر.");

        Guid? workflowTaskId = null;
        if (!string.IsNullOrWhiteSpace(request.WorkflowTaskId))
        {
            if (!Guid.TryParse(request.WorkflowTaskId, out var parsed))
                return (null, "معرّف المهمة غير صالح.");
            workflowTaskId = parsed;
            var ledger = await _db.InspectorFeeLedgers.AsNoTracking()
                .FirstOrDefaultAsync(l => l.WorkflowTaskId == parsed, cancellationToken);
            if (ledger is null)
                return (null, "سجل الأتعاب غير موجود.");
            if (!string.Equals(ledger.AssigneeId?.Trim(), target, StringComparison.Ordinal))
                return (null, "الطرف المستهدف لا يطابق سجل الأتعاب.");
            if (!string.Equals(ledger.PoNumber.Trim(), transactionKey, StringComparison.Ordinal))
                return (null, "أمر العمل لا يطابق سجل الأتعاب.");
        }

        var pendingExists = await _db.DiscountFlags.AnyAsync(
            x => x.TransactionKey == transactionKey
                && x.TargetAssigneeId == target
                && x.WorkflowTaskId == workflowTaskId
                && x.Status == DiscountFlagStatuses.Pending,
            cancellationToken);
        if (pendingExists)
            return (null, "يوجد وسم خصم معلّق لهذا الطرف على نفس البند.");

        var row = new DiscountFlag
        {
            Id = Guid.NewGuid(),
            TransactionKey = transactionKey,
            WorkflowTaskId = workflowTaskId,
            TargetAssigneeId = target,
            FlaggedByUserId = actorUserId,
            Reason = reason,
            ProposedDiscountSar = request.ProposedDiscountSar,
            Status = DiscountFlagStatuses.Pending,
            CreatedAtUtc = _time.UtcNow(),
        };
        _db.DiscountFlags.Add(row);
        await _db.SaveChangesAsync(cancellationToken);
        return (ToDto(row), null);
    }

    public async Task<(DiscountFlagDto? Row, string? Error)> ApproveAsync(
        Guid id,
        ResolveDiscountFlagRequest request,
        string actorUserId,
        string? actorDepartment,
        bool canManageAllDepartments,
        CancellationToken cancellationToken = default)
    {
        var flag = await _db.DiscountFlags
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (flag is null)
            return (null, "وسم الخصم غير موجود.");
        if (flag.Status != DiscountFlagStatuses.Pending)
            return (null, "تم حسم هذا الوسم مسبقاً.");

        var discount = request.DiscountSar ?? flag.ProposedDiscountSar;
        if (discount <= 0m)
            return (null, "مبلغ الخصم المعتمد يجب أن يكون أكبر من صفر.");
        var reason = string.IsNullOrWhiteSpace(request.DiscountReason)
            ? flag.Reason
            : request.DiscountReason.Trim();
        if (!InspectorFeeBillingRules.ValidateDiscount(discount, reason, out var discountError))
            return (null, discountError);

        var ledger = await ResolveTargetLedgerAsync(flag, cancellationToken);
        if (ledger is null)
            return (null, "لا يوجد بند أتعاب قابل للخصم لهذا الوسم.");
        if (!InspectorFeeBillingRules.IsEditableStatus(ledger.BillingStatus))
            return (null, "حالة البند لا تسمح بتطبيق خصم.");

        if (!SupervisingDepartments.CanManage(
                ledger.SupervisingDepartment,
                actorDepartment,
                canManageAllDepartments))
        {
            return (null, "هذا البند يتبع قسماً آخر — الاعتماد متاح لمشرف قسم المعاملة فقط.");
        }

        var fromStatus = ledger.BillingStatus;
        ledger.SupervisorDiscountSar = discount;
        ledger.DiscountReason = reason;
 // Employee path: approved flag lands as ready. Cooperator eng-survey keeps office-review.
        if (InspectorFeeRules.IsEmployee(ledger.InspectorType))
            ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
        else
        {
            var kinds = await _caseStudy.GetWorkflowTaskKindsAsync(
                [ledger.WorkflowTaskId],
                cancellationToken);
            if (kinds.TryGetValue(ledger.WorkflowTaskId, out var taskKind)
                && taskKind == WorkflowTaskKind.EngineeringSurvey
                && ledger.AccruedAtUtc is not null)
                ledger.BillingStatus = InspectorFeeBillingStatus.OfficeReview;
        }

        ledger.UpdatedAtUtc = _time.UtcNow();
        if (fromStatus != ledger.BillingStatus)
        {
            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = fromStatus,
                ToStatus = ledger.BillingStatus,
                Reason = reason,
                ActorUserId = actorUserId,
                CreatedAtUtc = _time.UtcNow(),
            });
        }

        flag.Status = DiscountFlagStatuses.Approved;
        flag.ApprovedByUserId = actorUserId;
        flag.ResolvedAtUtc = _time.UtcNow();
        flag.ResolutionNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        await _db.SaveChangesAsync(cancellationToken);
        return (ToDto(flag), null);
    }

    public async Task<(DiscountFlagDto? Row, string? Error)> RejectAsync(
        Guid id,
        ResolveDiscountFlagRequest request,
        string actorUserId,
        string? actorDepartment,
        bool canManageAllDepartments,
        CancellationToken cancellationToken = default)
    {
        var flag = await _db.DiscountFlags
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (flag is null)
            return (null, "وسم الخصم غير موجود.");
        if (flag.Status != DiscountFlagStatuses.Pending)
            return (null, "تم حسم هذا الوسم مسبقاً.");

        var ledger = await ResolveTargetLedgerAsync(flag, cancellationToken);
        if (ledger is not null
            && !SupervisingDepartments.CanManage(
                ledger.SupervisingDepartment,
                actorDepartment,
                canManageAllDepartments))
        {
            return (null, "هذا البند يتبع قسماً آخر — الرفض متاح لمشرف قسم المعاملة فقط.");
        }

        flag.Status = DiscountFlagStatuses.Rejected;
        flag.ApprovedByUserId = actorUserId;
        flag.ResolvedAtUtc = _time.UtcNow();
        flag.ResolutionNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        await _db.SaveChangesAsync(cancellationToken);
        return (ToDto(flag), null);
    }

    private async Task<InspectorFeeLedger?> ResolveTargetLedgerAsync(
        DiscountFlag flag,
        CancellationToken cancellationToken)
    {
        if (flag.WorkflowTaskId is Guid taskId)
        {
            return await _db.InspectorFeeLedgers
                .FirstOrDefaultAsync(l => l.WorkflowTaskId == taskId, cancellationToken);
        }

        return await _db.InspectorFeeLedgers
            .Where(l =>
                l.PoNumber == flag.TransactionKey
                && l.AssigneeId == flag.TargetAssigneeId
                && (l.BillingStatus == InspectorFeeBillingStatus.Draft
                    || l.BillingStatus == InspectorFeeBillingStatus.SupReview
                    || l.BillingStatus == InspectorFeeBillingStatus.AtFinance
                    || l.BillingStatus == InspectorFeeBillingStatus.OfficeReview
                    || l.BillingStatus == InspectorFeeBillingStatus.Returned
                    || l.BillingStatus == InspectorFeeBillingStatus.Inquiry
                    || l.BillingStatus == InspectorFeeBillingStatus.Deferred))
            .OrderByDescending(l => l.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static DiscountFlagDto ToDto(DiscountFlag row) => new()
    {
        Id = row.Id.ToString(),
        TransactionKey = row.TransactionKey,
        WorkflowTaskId = row.WorkflowTaskId?.ToString(),
        TargetAssigneeId = row.TargetAssigneeId,
        FlaggedByUserId = row.FlaggedByUserId,
        Reason = row.Reason,
        ProposedDiscountSar = row.ProposedDiscountSar,
        Status = row.Status,
        ApprovedByUserId = row.ApprovedByUserId,
        ResolvedAtUtc = row.ResolvedAtUtc,
        ResolutionNote = row.ResolutionNote,
        CreatedAtUtc = row.CreatedAtUtc,
    };
}
