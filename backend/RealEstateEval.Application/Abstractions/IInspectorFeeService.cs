using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface IInspectorFeeService
{
    Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default);

    Task EnsureLedgersForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Accrues an engineering-survey fee from the pricing table when the specialist
    /// accepts survey outputs. Idempotent if already accrued. Re-uploads do not create a second fee.
    /// </summary>
    Task<(InspectorFeeRowDto? Row, string? Error)> AccrueEngineeringSurveyFeeAsync(
        Guid workflowTaskId,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<InspectorFeesSummaryDto> GetSummaryAsync(
        string? assigneeId,
        string? workflowTaskId,
        bool submittedOnly,
        string? taskKind = null,
        string? billingStatus = null,
        string? returnTo = null,
        CancellationToken cancellationToken = default);

    Task<InspectorFeeRowDto?> GetByWorkflowTaskIdAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default);

    Task<InspectorFeeRowDto?> PatchAsync(
        Guid workflowTaskId,
        PatchInspectorFeeRequest request,
        CancellationToken cancellationToken = default);

    Task<(InspectorFeeRowDto? Row, string? Error)> TransitionAsync(
        Guid workflowTaskId,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default);

    Task<BatchInspectorFeeTransitionResult> BatchTransitionAsync(
        BatchInspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default);

    Task<CreateDisbursementBatchResult> CreateDisbursementBatchAsync(
        CreateDisbursementBatchRequest request,
        string actorUserId,
        string? actorAssigneeId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InspectorFeeAuditEntryDto>> ListTransitionsAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default);

    Task DeleteForWorkflowTaskIdsAsync(
        IEnumerable<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default);
}

public interface IPoEnfazBillingService
{
    Task<IReadOnlyList<EnfazReadyPoSummaryDto>> ListReadyPoSummariesAsync(
        CancellationToken cancellationToken = default);

    Task<PoEnfazBillingDto?> GetPoBillingAsync(string poNumber, CancellationToken cancellationToken = default);

    Task<PoEnfazBillingDto?> SavePoBillingAsync(
        string poNumber,
        SavePoEnfazBillingRequest request,
        CancellationToken cancellationToken = default);

    Task<PropertyEnfazRevenueDto?> GetPropertyRevenueAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EnfazTrackingRowDto>> ListTrackingAsync(
        CancellationToken cancellationToken = default);

    Task<PoEnfazBillingDto?> IssueInvoiceAsync(
        string poNumber,
        CancellationToken cancellationToken = default);

    /// <summary>Returns PDF bytes for an already-issued Enfaz invoice, or null if none.</summary>
    Task<byte[]?> GetInvoicePdfAsync(
        string poNumber,
        CancellationToken cancellationToken = default);
}
