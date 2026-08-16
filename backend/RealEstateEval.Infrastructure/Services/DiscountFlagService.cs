using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class DiscountFlagService : IDiscountFlagService
{
    private readonly FinancialDbContext _db;
    private readonly CaseStudyDbContext _caseStudy;

    public DiscountFlagService(FinancialDbContext db, CaseStudyDbContext caseStudy)
    {
        _db = db;
        _caseStudy = caseStudy;
    }

    public async Task<IReadOnlyList<DiscountFlagDto>> ListAsync(
        string? transactionKey = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.DiscountFlags.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(transactionKey))
            query = query.Where(x => x.TransactionKey == transactionKey.Trim());
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status.Trim());

        var rows = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(200)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
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
            CreatedAtUtc = DateTime.UtcNow,
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
            var taskKind = await _caseStudy.WorkflowTasks.AsNoTracking()
                .Where(t => t.Id == ledger.WorkflowTaskId)
                .Select(t => (WorkflowTaskKind?)t.Kind)
                .FirstOrDefaultAsync(cancellationToken);
            if (taskKind == WorkflowTaskKind.EngineeringSurvey && ledger.AccruedAtUtc is not null)
                ledger.BillingStatus = InspectorFeeBillingStatus.OfficeReview;
        }

        ledger.UpdatedAtUtc = DateTime.UtcNow;
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
                CreatedAtUtc = DateTime.UtcNow,
            });
        }

        flag.Status = DiscountFlagStatuses.Approved;
        flag.ApprovedByUserId = actorUserId;
        flag.ResolvedAtUtc = DateTime.UtcNow;
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
        flag.ResolvedAtUtc = DateTime.UtcNow;
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
