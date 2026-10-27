using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Application.Abstractions;

namespace RealEstateEval.Application.Abstractions;

public interface IInspectorFeeService : IInspectorFeeSummaryQuery
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
 /// Without a proposal the fee goes straight to finance; with one it waits for the department
 /// supervisor's decision.
 /// </summary>
    Task<(InspectorFeeRowDto? Row, string? Error)> AccrueEngineeringSurveyFeeAsync(
        Guid workflowTaskId,
        string actorUserId,
        CancellationToken cancellationToken = default,
        EngineeringSurveyDiscountProposalInput? proposal = null);

 /// <summary>The supervisor approves, amends or waives the specialist's proposed discount.</summary>
    Task<(InspectorFeeRowDto? Row, string? Error)> ResolveDiscountProposalAsync(
        Guid workflowTaskId,
        ResolveDiscountProposalRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false);

 /// <summary>
 /// Cancels one party's whole fee on a transaction: every line not yet in a statement, paid or
 /// withheld is discounted in full. The lines left untouched come back as skipped.
 /// </summary>
    Task<(WaivePartyFeesResultDto? Result, string? Error)> WaivePartyFeesAsync(
        string poNumber,
        WaivePartyFeesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false);

    Task<InspectorFeeRowDto?> PatchAsync(
        Guid workflowTaskId,
        PatchInspectorFeeRequest request,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false);

    Task<(InspectorFeeRowDto? Row, string? Error)> TransitionAsync(
        Guid workflowTaskId,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false);

    Task<BatchInspectorFeeTransitionResponseDto> BatchTransitionAsync(
        BatchInspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false);

    Task DeleteForWorkflowTaskIdsAsync(
        IEnumerable<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default);
}

public interface IPoEnfazBillingService
{
    Task<IReadOnlyList<EnfazReadyPoSummaryDto>> ListReadyPoSummariesAsync(
        CancellationToken cancellationToken = default);

 /// <summary>Ready POs with the search and sort of pagination-contract; plain array.</summary>
    Task<IReadOnlyList<EnfazReadyPoSummaryDto>> ListReadyPoSummariesAsync(
        EnfazReadyPoListQuery query,
        CancellationToken cancellationToken = default);

 /// <summary>One page of ready POs, cut over the materialised readiness scan — section 10.1.</summary>
    Task<PagedResultDto<EnfazReadyPoSummaryDto>> ListReadyPoSummariesPagedAsync(
        EnfazReadyPoListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

    Task<PoEnfazBillingDto?> GetPoBillingAsync(string poNumber, CancellationToken cancellationToken = default);

    /// <summary>
    /// Saves the fee lines. Refused with an Arabic error once the PO's invoice is issued — the
    /// invoice stamps its totals, so later edits would silently drift from it.
    /// </summary>
    Task<(PoEnfazBillingDto? Billing, string? Error)> SavePoBillingAsync(
        string poNumber,
        SavePoEnfazBillingRequest request,
        CancellationToken cancellationToken = default);

    Task<PropertyEnfazRevenueDto?> GetPropertyRevenueAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EnfazTrackingRowDto>> ListTrackingAsync(
        CancellationToken cancellationToken = default);

 /// <summary>Tracking rows with the search and sort of pagination-contract; plain array.</summary>
    Task<IReadOnlyList<EnfazTrackingRowDto>> ListTrackingAsync(
        EnfazTrackingListQuery query,
        CancellationToken cancellationToken = default);

 /// <summary>One page of tracking rows, cut over the materialised scan — section 10.2.</summary>
    Task<PagedResultDto<EnfazTrackingRowDto>> ListTrackingPagedAsync(
        EnfazTrackingListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

    Task<(PoEnfazBillingDto? Billing, string? Error)> IssueInvoiceAsync(
        string poNumber,
        CancellationToken cancellationToken = default);

    Task<(PoEnfazBillingDto? Billing, string? Error)> CollectInvoiceAsync(
        string poNumber,
        CollectPoEnfazInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<EnfazAgingReportDto> GetAgingReportAsync(
        CancellationToken cancellationToken = default);

 /// <summary>Returns PDF bytes for an already-issued Enfaz invoice, or null if none.</summary>
    Task<byte[]?> GetInvoicePdfAsync(
        string poNumber,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EnfazFollowupDto>> ListFollowupsAsync(
        string poNumber,
        CancellationToken cancellationToken = default);

    Task<(EnfazFollowupDto? Followup, string? Error)> AddFollowupAsync(
        string poNumber,
        AddEnfazFollowupRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(bool Ok, string? Error)> SetFinanceFlagAsync(
        string poNumber,
        SetEnfazFinanceFlagRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(bool Ok, string? Error)> ClearFinanceFlagAsync(
        string poNumber,
        string? propertyId,
        CancellationToken cancellationToken = default);
}
