using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>The issue's per-deed reads: the deed kinds (match gate), the survey after a type change and the active-failure gate.</summary>
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

    /// <summary>
    /// The field inspector of this study said the deed does not match nature — «مطابق» then needs the
    /// specialist's reason. Only when the deed-match field is in play (a matched outcome).
    /// </summary>
    private async Task<bool> InspectorSaidNotMatchedAsync(Guid studyTaskId, CancellationToken cancellationToken) =>
        Rules.InspectorDeedNatureMatchRules.InspectorSaidNotMatched(
            await _db.GetInspectionPayloadJsonAsync(studyTaskId, cancellationToken));

    /// <summary>
    /// The engineering office of this study submitted «الصك غير مطابق للطبيعة» — «مطابق» then needs the
    /// specialist's reason too (A→Z 2026-11-02 #20). How it works: reads the office's submitted survey payload.
    /// Edge cases: no survey task, or a survey not yet submitted, is false.
    /// </summary>
    private async Task<bool> OfficeSaidNotMatchedAsync(Guid studyTaskId, CancellationToken cancellationToken) =>
        Rules.InspectorDeedNatureMatchRules.EngineeringOfficeSaidNotMatched(
            await _db.GetSubmittedEngineeringSurveyPayloadJsonAsync(studyTaskId, cancellationToken));

    private async Task<bool> HasActiveFailureAsync(
        WorkflowTask task,
        Guid? propertyId,
        CancellationToken cancellationToken)
    {
        if (_failureGate is null || propertyId is not Guid pid || pid == Guid.Empty) return false;
        return await _failureGate.HasBlockingFailureAsync(task.PoNumber, pid.ToString("D"), cancellationToken);
    }
}
