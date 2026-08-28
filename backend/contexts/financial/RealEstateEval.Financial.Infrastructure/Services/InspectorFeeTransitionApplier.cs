using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed class InspectorFeeTransitionApplier : IInspectorFeeTransitionApplier
{
    private const string FeeBillingTransitionAction = "FEE_BILLING_TRANSITION";
    private const string FeeLedgerEntityType = "inspector_fee_ledger";

    private readonly FinancialDbContext _financial;
    private readonly ICaseStudyLookup _lookup;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public InspectorFeeTransitionApplier(
        FinancialDbContext financial,
        ICaseStudyLookup lookup,
        IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _financial = financial;
        _lookup = lookup;
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

 //DisbursementBatch creation is retired for every task kind.
        if (action == InspectorFeeActions.CreateDisbursementRequest)
        {
            return "إنشاء طلب صرف متوقف — البنود الجاهزة تُفوتر عبر كشف الأطراف.";
        }

        if (action == InspectorFeeActions.SubmitToSupervisor)
        {
            var kinds = await _lookup.GetWorkflowTaskKindsAsync(
                [ledger.WorkflowTaskId],
                cancellationToken);
            if (kinds.TryGetValue(ledger.WorkflowTaskId, out var taskKind)
                && taskKind == WorkflowTaskKind.EngineeringSurvey)
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
                ? $"SND-{_time.UtcNow():yyyyMMddHHmmss}"
                : request.DisbursementVoucher.Trim();
            ledger.DisbursementVoucher = voucher;
        }

        var before = SnapshotLedger(ledger, fromStatus);

        ledger.BillingStatus = nextStatus;
        ledger.ReturnTo = nextReturnTo;
        ledger.UpdatedAtUtc = _time.UtcNow();

 // E6 (بنود البتّ 9 و12): المهلة تُختم عند الدخول إلى «معترض» فقط، وتسقط مع
 // سجل مراحلها عند أي خروج منه (بأي اتجاه) — سقوطها هو إلغاء التذكيرات المعلقة.
        if (nextStatus == InspectorFeeBillingStatus.Disputed
            && fromStatus != InspectorFeeBillingStatus.Disputed)
        {
            ledger.DisputeDeadlineUtc =
                BillingNegotiationDeadlines.DeadlineFromUtc(_time.UtcNow());
            ledger.DisputeNotifiedStages = null;
        }
        else if (nextStatus != InspectorFeeBillingStatus.Disputed
            && ledger.DisputeDeadlineUtc is not null)
        {
            ledger.DisputeDeadlineUtc = null;
            ledger.DisputeNotifiedStages = null;
        }

        _financial.InspectorFeeTransitions.Add(new InspectorFeeTransition
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            FromStatus = fromStatus,
            ToStatus = nextStatus,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            ActorUserId = actorUserId,
            CreatedAtUtc = _time.UtcNow(),
        });

        _financial.AuditLogs.Add(_audit.Create(
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
        var snapshot = await _lookup.GetWorkflowTaskAsync(workflowTaskId, cancellationToken);
        if (snapshot is null) return false;
        var task = snapshot.ToWorkflowTask();

        var workspaceRows = await _lookup.ListFieldInspectionWorkspacesByTaskIdsAsync(
            [workflowTaskId],
            cancellationToken);
        var submissionRows = await _lookup.ListPartyTaskSubmissionsByTaskIdsAsync(
            [workflowTaskId],
            cancellationToken);
        var workspaces = workspaceRows.ToDictionary(w => w.WorkflowTaskId, w => w.ToWorkspace());
        var submissions = submissionRows.ToDictionary(s => s.WorkflowTaskId, s => s.ToSubmission());

        return InspectorFeeWorkStatusRules.IsWorkSubmitted(
            workflowTaskId,
            new Dictionary<Guid, WorkflowTask> { [workflowTaskId] = task },
            workspaces,
            submissions);
    }
}
