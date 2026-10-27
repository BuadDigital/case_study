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
    /// Ready for the handover: closed, or at least one task and none left that is neither
    /// completed nor cancelled (report issued, valuation deposited, parties complete).
    /// </summary>
    public static bool IsReady(WorkOrderProperty property, IReadOnlyList<WorkflowTask> propertyTasks) =>
        property.EnfazHandoverAtUtc is not null
        || (propertyTasks.Count > 0
            && propertyTasks.All(t =>
                t.Status == WorkflowTaskStatus.Cancelled || t.Status == WorkflowTaskStatus.Completed));
}
