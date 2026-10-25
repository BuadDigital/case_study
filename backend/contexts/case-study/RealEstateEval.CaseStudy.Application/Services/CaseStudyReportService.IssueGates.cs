using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>The issue's per-deed reads: the deed kinds (D16 match gate) and the active-failure gate.</summary>
public partial class CaseStudyReportService
{
    /// <summary>The deed kinds of every deed the one study covers (the holder's own when it stands alone).</summary>
    private async Task<IReadOnlyList<DeedKind>> TransactionDeedKindsAsync(
        IReadOnlyList<WorkflowTask> parents,
        WorkflowTask task,
        Guid? holderPropertyId,
        CancellationToken cancellationToken)
    {
        var kinds = new List<DeedKind>();
        var seen = new HashSet<Guid>();
        foreach (var parent in parents)
        {
            var id = parent.Id == task.Id ? holderPropertyId ?? parent.PropertyId : parent.PropertyId;
            if (id is not Guid pid || pid == Guid.Empty || !seen.Add(pid)) continue;
            var property = await _db.GetPropertyForUpdateAsync(pid, cancellationToken);
            if (property is not null) kinds.Add(property.DeedKind);
        }

        return kinds;
    }

    private async Task<bool> HasActiveFailureAsync(
        WorkflowTask task,
        Guid? propertyId,
        CancellationToken cancellationToken)
    {
        if (_failureGate is null || propertyId is not Guid pid || pid == Guid.Empty) return false;
        return await _failureGate.HasBlockingFailureAsync(task.PoNumber, pid.ToString("D"), cancellationToken);
    }
}
