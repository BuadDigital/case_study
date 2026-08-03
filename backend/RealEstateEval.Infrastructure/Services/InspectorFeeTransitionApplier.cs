using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class InspectorFeeTransitionApplier : IInspectorFeeTransitionApplier
{
    private const string FeeBillingTransitionAction = "FEE_BILLING_TRANSITION";
    private const string FeeLedgerEntityType = "inspector_fee_ledger";

    private readonly ApplicationDbContext _db;
    private readonly IAuditLogWriter _audit;

    public InspectorFeeTransitionApplier(ApplicationDbContext db)
        : this(db, new AuditLogWriter())
    {
    }

    public InspectorFeeTransitionApplier(ApplicationDbContext db, IAuditLogWriter audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<string?> ApplyAsync(
        InspectorFeeLedger ledger,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        var fromStatus = ledger.BillingStatus;

        if (InspectorFeeRules.IsEmployee(ledger.InspectorType)
            && action is InspectorFeeActions.OfficeApproveDiscount
                or InspectorFeeActions.OfficeDispute
                or InspectorFeeActions.ResolveDispute)
        {
            return "مسار الموظف لا يدعم خلاف التسعير — الخصم يُبلَّغ ويصبح جاهزاً مباشرة.";
        }

        if (!InspectorFeeTransitionAuthorization.CanPerformAction(
                action, ledger, actorAssigneeId, isOperationsManager, isFinancialOfficer))
            return "غير مصرّح بتنفيذ هذا الإجراء.";
        if (RequiresDepartmentSupervisor(action)
            && !SupervisingDepartments.CanManage(
                ledger.SupervisingDepartment,
                actorDepartment,
                canManageAllDepartments))
        {
            return "هذا البند يتبع قسماً آخر — الإجراء متاح لمشرف قسم المعاملة فقط.";
        }

        // ج٩ / ق٦: DisbursementBatch creation is retired for every task kind.
        if (action == InspectorFeeActions.CreateDisbursementRequest)
        {
            return "إنشاء طلب صرف متوقف — البنود الجاهزة تُفوتر عبر كشف الأطراف.";
        }

        if (action == InspectorFeeActions.SubmitToSupervisor)
        {
            var taskKind = await _db.WorkflowTasks.AsNoTracking()
                .Where(t => t.Id == ledger.WorkflowTaskId)
                .Select(t => t.Kind)
                .FirstOrDefaultAsync(cancellationToken);
            if (taskKind == WorkflowTaskKind.EngineeringSurvey)
            {
                return "مسار المكتب الهندسي لا يدعم رفع الأتعاب للمشرف — استخدم موافقة الحسم أو الاعتراض من الكشف المبدئي.";
            }
        }

        if (!InspectorFeeBillingRules.TryResolveTransition(
                fromStatus,
                action,
                out var nextStatus,
                out var nextReturnTo,
                out var transitionError,
                ledger.PreSuspensionStatus))
        {
            return transitionError;
        }

        if (action == InspectorFeeActions.Suspend)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
                return "سبب الإيقاف مطلوب.";

            ledger.PreSuspensionStatus = fromStatus;
            ledger.SuspensionReason = request.Reason.Trim();
        }

        if (action == InspectorFeeActions.LiftSuspension)
        {
            ledger.PreSuspensionStatus = null;
            ledger.SuspensionReason = null;
        }

        if (action == InspectorFeeActions.SubmitToSupervisor)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن رفع عقار مستبعد.";

            if (!InspectorFeeRules.HasBillableAgreedFee(ledger.AgreedFeeSar))
                return "يجب إدخال مبلغ الأتعاب المتفق عليه قبل الرفع.";

            if (!InspectorFeeBillingRules.ValidateDiscount(
                    ledger.SupervisorDiscountSar,
                    ledger.DiscountReason,
                    out var discountError))
            {
                return discountError;
            }

            if (!await IsLedgerWorkSubmittedAsync(ledger.WorkflowTaskId, cancellationToken))
                return "لا يمكن رفع الأتعاب قبل إتمام عمل الطرف.";

            if (fromStatus == InspectorFeeBillingStatus.Returned
                && ledger.ReturnTo != InspectorFeeReturnTo.Office)
            {
                return "هذه المعاملة ليست مُعادة للمكتب.";
            }

            if (fromStatus == InspectorFeeBillingStatus.Inquiry
                && ledger.ReturnTo != InspectorFeeReturnTo.Office)
            {
                return "هذا الاستفسار لا يخص المكتب.";
            }
        }

        if (action == InspectorFeeActions.ApproveToFinance)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن اعتماد عقار مستبعد.";

            if (!InspectorFeeRules.HasBillableAgreedFee(ledger.AgreedFeeSar))
                return "يجب إدخال مبلغ الأتعاب المتفق عليه قبل الاعتماد.";

            if (!InspectorFeeBillingRules.ValidateDiscount(
                    ledger.SupervisorDiscountSar,
                    ledger.DiscountReason,
                    out var discountError))
            {
                return discountError;
            }

            if (!await IsLedgerWorkSubmittedAsync(ledger.WorkflowTaskId, cancellationToken))
                return "لا يمكن اعتماد الأتعاب قبل إتمام عمل الطرف.";
        }

        if (action is InspectorFeeActions.OfficeApproveDiscount
            or InspectorFeeActions.OfficeDispute)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن معالجة عقار مستبعد.";

            if (ledger.SupervisorDiscountSar <= 0m)
                return "لا يوجد حسم يحتاج موافقة المكتب.";

            if (action == InspectorFeeActions.OfficeDispute
                && string.IsNullOrWhiteSpace(request.Reason))
            {
                return "سبب الاعتراض مطلوب.";
            }
        }

        if (action == InspectorFeeActions.ResolveDispute)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن حسم خلاف لعقار مستبعد.";

            if (!InspectorFeeRules.HasBillableAgreedFee(ledger.AgreedFeeSar))
                return "يجب إدخال مبلغ الأتعاب المتفق عليه قبل الحسم.";

            if (!InspectorFeeBillingRules.ValidateDiscount(
                    ledger.SupervisorDiscountSar,
                    ledger.DiscountReason,
                    out var resolveDiscountError))
            {
                return resolveDiscountError;
            }
        }

        if (action == InspectorFeeActions.ResendToFinance)
        {
            if (ledger.ReturnTo != InspectorFeeReturnTo.Supervisor)
                return "لا يمكن إعادة الإرسال إلا للمعاملات المُعادة للمشرف.";
        }

        if (action == InspectorFeeActions.ReturnToOffice)
        {
            if (ledger.ReturnTo != InspectorFeeReturnTo.Supervisor)
                return "لا يمكن إرجاع المعاملة للمكتب إلا من قائمة المُعاد للمشرف.";
        }

        if (action is InspectorFeeActions.ReturnToSupervisor or InspectorFeeActions.InquiryToOffice)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
                return action == InspectorFeeActions.InquiryToOffice
                    ? "سبب الاستفسار مطلوب."
                    : "سبب الإرجاع مطلوب.";

            if (action == InspectorFeeActions.ReturnToSupervisor && ledger.DisbursementBatchId.HasValue)
                ledger.DisbursementBatchId = null;
        }

        if (action == InspectorFeeActions.Disburse)
        {
            var voucher = string.IsNullOrWhiteSpace(request.DisbursementVoucher)
                ? $"SND-{DateTime.UtcNow:yyyyMMddHHmmss}"
                : request.DisbursementVoucher.Trim();
            ledger.DisbursementVoucher = voucher;
        }

        var before = SnapshotLedger(ledger, fromStatus);

        ledger.BillingStatus = nextStatus;
        ledger.ReturnTo = nextReturnTo;
        ledger.UpdatedAtUtc = DateTime.UtcNow;

        _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            FromStatus = fromStatus,
            ToStatus = nextStatus,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            ActorUserId = actorUserId,
            CreatedAtUtc = DateTime.UtcNow,
        });

        _db.AuditLogs.Add(_audit.Create(
            string.IsNullOrWhiteSpace(actorUserId) ? "system" : actorUserId,
            FeeBillingTransitionAction,
            FeeLedgerEntityType,
            ledger.Id.ToString(),
            before,
            SnapshotLedger(ledger, nextStatus)));

        return null;
    }

    private static object SnapshotLedger(InspectorFeeLedger ledger, string billingStatus) => new
    {
        workflowTaskId = ledger.WorkflowTaskId,
        billingStatus,
        returnTo = ledger.ReturnTo,
        agreedFeeSar = ledger.AgreedFeeSar,
        supervisorDiscountSar = ledger.SupervisorDiscountSar,
        netFeeSar = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, ledger.SupervisorDiscountSar),
        statementId = ledger.PartyBillingStatementId,
        disbursementBatchId = ledger.DisbursementBatchId,
    };

    private static bool RequiresDepartmentSupervisor(string action) =>
        action is InspectorFeeActions.ApproveToFinance
            or InspectorFeeActions.ResendToFinance
            or InspectorFeeActions.ReturnToOffice
            or InspectorFeeActions.ResolveDispute
            or InspectorFeeActions.Suspend
            or InspectorFeeActions.LiftSuspension;

    private async Task<bool> IsLedgerWorkSubmittedAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken)
    {
        var task = await _db.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == workflowTaskId, cancellationToken);
        if (task is null) return false;

        var workspaces = await _db.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => w.WorkflowTaskId == workflowTaskId)
            .ToDictionaryAsync(w => w.WorkflowTaskId, cancellationToken);
        var submissions = await _db.PartyTaskSubmissions.AsNoTracking()
            .Where(s => s.WorkflowTaskId == workflowTaskId)
            .ToDictionaryAsync(s => s.WorkflowTaskId, cancellationToken);

        return InspectorFeeWorkStatusRules.IsWorkSubmitted(
            workflowTaskId,
            new Dictionary<Guid, WorkflowTask> { [workflowTaskId] = task },
            workspaces,
            submissions);
    }
}
