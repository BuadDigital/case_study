using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Cross-service Case Study reads. The Case Study host uses EF; Financial and Operations call HTTP.
/// </summary>
public interface ICaseStudyLookup
{
    Task<IReadOnlyList<Guid>> ListCompletedCaseStudyPropertyIdsAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<Guid, WorkflowTaskKind>> GetWorkflowTaskKindsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyWorkOrderSummaryDto>> ListWorkOrderSummariesAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Distinct PO numbers of workflow tasks assigned to any of the given assignee/user ids
    /// (any kind or status). Used as the failures visibility filter.
    /// </summary>
    Task<IReadOnlyList<string>> ListPoNumbersByAssigneesAsync(
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken = default);

    Task<CaseStudyPropertySnapshotDto?> GetPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// One-call read of everything Valuation needs for a property: aggregate fields,
    /// inventory lines, latest inspection workspace + inspector payload, latest
    /// deed↔nature outcome, and client display names. Includes soft-removed properties.
    /// </summary>
    Task<CaseStudyValuationPropertyContextDto?> GetValuationPropertyContextAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task<CaseStudyPropertySnapshotDto?> GetPropertyByPoAndDeedAsync(
        string poNumber,
        string deedNumber,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByIdsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByRequestNumbersAsync(
        IReadOnlyList<string> requestNumbers,
        CancellationToken cancellationToken = default);

    Task<string?> GetCaseSpecialistAssigneeAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyGovReviewKeyStatusDto>> ListGovReviewKeyStatusesAsync(
        CancellationToken cancellationToken = default);

    Task<CaseStudyWorkflowTaskSnapshotDto?> GetWorkflowTaskAsync(
        Guid taskId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByIdsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByPropertyAsync(
        Guid propertyId,
        IReadOnlyList<WorkflowTaskKind>? kinds = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByKindsAsync(
        IReadOnlyList<WorkflowTaskKind> kinds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyPartyTaskSubmissionSnapshotDto>> ListPartyTaskSubmissionsByTaskIdsAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyFieldInspectionWorkspaceSnapshotDto>> ListFieldInspectionWorkspacesByTaskIdsAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default);

    Task<Guid?> GetWorkOrderIdByPoNumberAsync(
        string poNumber,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, DateTime?>> GetWorkOrderReceivedAtByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CaseStudyWorkOrderBillingSnapshotDto>> ListWorkOrdersForBillingAsync(
        int take,
        CancellationToken cancellationToken = default);

    Task<CaseStudyWorkOrderBillingSnapshotDto?> GetWorkOrderForBillingAsync(
        string poNumber,
        CancellationToken cancellationToken = default);
}
