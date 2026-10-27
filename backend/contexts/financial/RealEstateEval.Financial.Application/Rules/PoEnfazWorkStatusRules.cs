using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Application.Rules;

internal static class PoEnfazWorkStatusRules
{
    internal static PoEnfazFinanceFlag? ResolveFinanceFlag(
        IReadOnlyList<PoEnfazFinanceFlag> flags,
        Guid propertyId)
    {
        var exact = flags.FirstOrDefault(f => f.PropertyId == propertyId);
        if (exact is not null) return exact;
        return flags.FirstOrDefault(f => f.PropertyId is null);
    }

    /// <summary>
    /// «تاريخ الاكتمال» per property: the Enfaz handover when recorded (the work is done only once
    /// delivered), else the last completed task — the 30-day stall clock and the «completed» sort
    /// read this.
    /// </summary>
    internal static Dictionary<Guid, DateTime?> BuildPropertyCompletedAtById(
        IReadOnlyList<WorkflowTask> tasks,
        IReadOnlyList<CaseStudyPropertySnapshotDto> properties)
    {
        var result = new Dictionary<Guid, DateTime?>();
        foreach (var group in tasks
                     .Where(t => t.PropertyId.HasValue
                                 && t.Status == WorkflowTaskStatus.Completed)
                     .GroupBy(t => t.PropertyId!.Value))
        {
            result[group.Key] = group.Max(t => t.UpdatedAtUtc);
        }

        foreach (var property in properties.Where(p => p.EnfazHandoverAtUtc is not null))
            result[property.Id] = property.EnfazHandoverAtUtc;

        return result;
    }

    internal static Dictionary<string, Dictionary<Guid, (string Status, string Label)>> BuildPropertyWorkStatusesByPo(
        IReadOnlyList<WorkflowTask> tasks,
        IReadOnlyList<CaseStudyPropertySnapshotDto> properties)
    {
        var byPo = tasks
            .GroupBy(t => t.PoNumber.Trim(), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        var result = new Dictionary<string, Dictionary<Guid, (string, string)>>(StringComparer.Ordinal);
        foreach (var (po, poTasks) in byPo)
        {
            var propertyIds = poTasks
                .Where(t => t.PropertyId.HasValue)
                .Select(t => t.PropertyId!.Value)
                .Distinct()
                .ToList();
            result[po] = ComputePropertyWorkStatuses(propertyIds, poTasks, HandedOverIds(properties));
        }

        return result;
    }

    /// <summary>Properties carrying the Enfaz handover stamp.</summary>
    internal static HashSet<Guid> HandedOverIds(IReadOnlyList<CaseStudyPropertySnapshotDto> properties) =>
        properties
            .Where(p => p.EnfazHandoverAtUtc is not null)
            .Select(p => p.Id)
            .ToHashSet();

    /// <summary>
    /// Work status of each property as Finance reads it: <c>done</c> only once the specialist
    /// handed the transaction over to Enfaz (delivered); tasks complete but not yet handed over
    /// stay <c>in_progress</c>; every task cancelled is <c>cancelled</c>.
    /// </summary>
    internal static Dictionary<Guid, (string Status, string Label)> ComputePropertyWorkStatuses(
        IReadOnlyList<Guid> propertyIds,
        IReadOnlyList<WorkflowTask> tasks,
        IReadOnlySet<Guid> handedOverPropertyIds)
    {
        var result = new Dictionary<Guid, (string, string)>();
        foreach (var propertyId in propertyIds)
        {
            var propertyTasks = tasks.Where(t => t.PropertyId == propertyId).ToList();
            if (propertyTasks.Count == 0)
            {
                result[propertyId] = (
                    InspectorFeeWorkStatuses.InProgress,
                    InspectorFeeBillingRules.WorkStatusLabel(InspectorFeeWorkStatuses.InProgress));
                continue;
            }

            if (propertyTasks.All(t => t.Status == WorkflowTaskStatus.Cancelled))
            {
                result[propertyId] = (
                    InspectorFeeWorkStatuses.Cancelled,
                    InspectorFeeBillingRules.WorkStatusLabel(InspectorFeeWorkStatuses.Cancelled));
                continue;
            }

            var status = handedOverPropertyIds.Contains(propertyId)
                ? InspectorFeeWorkStatuses.Done
                : InspectorFeeWorkStatuses.InProgress;
            result[propertyId] = (status, InspectorFeeBillingRules.WorkStatusLabel(status));
        }

        return result;
    }

    /// <summary>
    /// A work order can be matched and invoiced once every live property is marked «جاهز للفوترة»
    /// by the accountant (its financial data appeared on Enfaz), or every task on it is cancelled.
    /// Handed over alone is not enough: Enfaz still reviews the order before its figures exist.
    /// Removed properties are ignored; a live property without any task is not ready.
    /// </summary>
    /// <remarks>
    /// How it works: 1) takes the live (not removed) properties; none → not ready. 2) Each live property
    /// must be marked ready (BillingReadyAtUtc set) — or have tasks and every one of them cancelled.
    /// 3) One property that is neither fails the whole order.
    /// Edge cases and the fix: readiness used to be computed from the handover stamp alone, so an order was
    /// billable the moment its deeds were uploaded — before Enfaz's procurement review had produced any
    /// figures. It now follows the accountant's manual mark. Consequences: an order with one unmarked deed
    /// is not ready (partial billing, e.g. 4 of 7 deeds, is not possible until the invoice itself becomes
    /// per deed); a deed returned from Enfaz loses its mark with its stamp, so it drops out again; a deed
    /// with no tasks at all is not ready.
    /// </remarks>
    internal static bool IsPoReadyForEnfazBilling(
        IReadOnlyList<CaseStudyPropertySnapshotDto> properties,
        IReadOnlyList<WorkflowTask> poTasks)
    {
        var live = properties.Where(p => !p.IsRemoved).ToList();
        if (live.Count == 0) return false;

        foreach (var property in live)
        {
            if (property.BillingReadyAtUtc is not null)
                continue;

            var propertyTasks = poTasks
                .Where(t => t.PropertyId == property.Id)
                .ToList();
            if (propertyTasks.Count == 0)
                return false;

            if (!propertyTasks.All(t => t.Status == WorkflowTaskStatus.Cancelled))
                return false;
        }

        return true;
    }
}
