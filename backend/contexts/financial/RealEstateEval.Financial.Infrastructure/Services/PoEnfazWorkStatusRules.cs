using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

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

    internal static Dictionary<Guid, DateTime?> BuildPropertyCompletedAtById(
        IReadOnlyList<WorkflowTask> tasks)
    {
        var result = new Dictionary<Guid, DateTime?>();
        foreach (var group in tasks
                     .Where(t => t.PropertyId.HasValue
                                 && t.Status == WorkflowTaskStatus.Completed)
                     .GroupBy(t => t.PropertyId!.Value))
        {
            result[group.Key] = group.Max(t => t.UpdatedAtUtc);
        }

        return result;
    }

    internal static Dictionary<string, Dictionary<Guid, (string Status, string Label)>> BuildPropertyWorkStatusesByPo(
        IReadOnlyList<WorkflowTask> tasks)
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
            result[po] = ComputePropertyWorkStatuses(propertyIds, poTasks);
        }

        return result;
    }

    internal static Dictionary<Guid, (string Status, string Label)> ComputePropertyWorkStatuses(
        IReadOnlyList<Guid> propertyIds,
        IReadOnlyList<WorkflowTask> tasks)
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

            var active = propertyTasks.Where(t => t.Status != WorkflowTaskStatus.Cancelled).ToList();
            var allDone = active.Count > 0 && active.All(t => t.Status == WorkflowTaskStatus.Completed);
            var status = allDone ? InspectorFeeWorkStatuses.Done : InspectorFeeWorkStatuses.InProgress;
            result[propertyId] = (status, InspectorFeeBillingRules.WorkStatusLabel(status));
        }

        return result;
    }

    internal static bool IsPoReadyForEnfazBilling(
        IReadOnlyList<CaseStudyPropertySnapshotDto> properties,
        IReadOnlyList<WorkflowTask> poTasks)
    {
        if (properties.Count == 0) return false;

        foreach (var property in properties)
        {
            var propertyTasks = poTasks
                .Where(t => t.PropertyId == property.Id)
                .ToList();
            if (propertyTasks.Count == 0)
                return false;

            var active = propertyTasks
                .Where(t => t.Status != WorkflowTaskStatus.Cancelled)
                .ToList();
            if (active.Count == 0)
                continue;

            if (!active.All(t => t.Status == WorkflowTaskStatus.Completed))
                return false;
        }

        return true;
    }
}
