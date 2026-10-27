using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// When a property counts as delivered or deliverable, for the PO list status, its counters and
/// the property-row status. Delivery is the Enfaz handover, not the case-study report.
/// <c>WorkOrderQueryService</c> carries the same two rules as EF expressions — change both.
/// </summary>
public static class PropertyDeliveryRules
{
    /// <summary>
    /// Closed: handed over to Enfaz, or every task on the property was cancelled (nothing left to
    /// deliver — the same exception Finance applies).
    /// </summary>
    public static bool IsClosed(WorkOrderProperty property, IReadOnlyList<WorkflowTask> propertyTasks) =>
        property.EnfazHandoverAtUtc is not null
        || (propertyTasks.Count > 0
            && propertyTasks.All(t => t.Status == WorkflowTaskStatus.Cancelled));

    /// <summary>
    /// Ready for the handover: closed, or no task left that is neither completed nor cancelled AND
    /// a completed appraisal task — the valuation deposited (the appraiser's task completes only at
    /// the final issuance). The study is issued before the valuation, so a completed case-study
    /// task alone is not ready; neither is a deed that never had an appraisal task.
    /// </summary>
    public static bool IsReady(WorkOrderProperty property, IReadOnlyList<WorkflowTask> propertyTasks) =>
        IsClosed(property, propertyTasks)
        || (propertyTasks.All(t =>
                t.Status == WorkflowTaskStatus.Cancelled || t.Status == WorkflowTaskStatus.Completed)
            && HasDepositedValuation(propertyTasks));

    /// <summary>The property has a completed appraisal task (final issuance with the deposit certificate).</summary>
    public static bool HasDepositedValuation(IReadOnlyList<WorkflowTask> propertyTasks) =>
        propertyTasks.Any(t =>
            t.Kind == WorkflowTaskKind.PropertyAppraisal && t.Status == WorkflowTaskStatus.Completed);
}
