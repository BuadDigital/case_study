using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Batch 2C: the appraiser's view of what the inspector's package looks like now (per-section fingerprint) and
/// which sections changed since the fingerprint he acknowledged; plus the inspector-side alert when a save
/// changes data the appraiser already looked at.
/// </summary>
public partial class PartyTaskSubmissionService
{
    /// <summary>
    /// The inspection the appraiser reads on a parent + property: the latest completed one, else the latest
    /// that is not cancelled (a draft in progress).
    /// </summary>
    private static WorkflowTask? PickInspectionTask(IEnumerable<WorkflowTask> siblings) =>
        siblings
            .Where(t => t.Kind == WorkflowTaskKind.FieldInspection && t.Status != WorkflowTaskStatus.Cancelled)
            .OrderByDescending(t => t.Status == WorkflowTaskStatus.Completed)
            .ThenByDescending(t => t.CreatedAtUtc)
            .FirstOrDefault();

    private static void ApplyInspectorDigest(
        PartyTaskSubmissionDto dto,
        string appraiserPayloadJson,
        string inspectorPayloadJson,
        WorkOrderProperty? property)
    {
        var hashes = InspectorDataDigestRules.Compute(
            inspectorPayloadJson,
            property?.BuildingInventoryLines,
            property?.SpecialistComponentsText);
        dto.InspectorDataFingerprint = InspectorDataDigestRules.Encode(hashes);
        dto.InspectorDataChangedGroups = InspectorDataDigestRules
            .ChangedGroups(
                PartyTaskSubmissionPayloadRules.ReadString(appraiserPayloadJson, InspectorDataDigestRules.SeenPayloadKey),
                hashes)
            .ToList();
    }

    /// <summary>Single read: fingerprint + changed sections of one appraisal package.</summary>
    private async Task ApplyInspectorDataDigestAsync(
        PartyTaskSubmissionDto dto,
        PartyTaskSubmission appraisal,
        CancellationToken cancellationToken)
    {
        if (appraisal.PropertyId is not Guid propertyId) return;

        var facts = await _repo.ListTaskFactsAsync([appraisal.WorkflowTaskId], cancellationToken);
        if (facts.Count == 0 || facts[0].ParentTaskId is not Guid parentTaskId) return;

        var inspection = PickInspectionTask(
            await _repo.ListSiblingTasksAsync([parentTaskId], [propertyId], cancellationToken));
        if (inspection is null) return;

        var submission = await _repo.GetSubmissionAsync(inspection.Id, track: false, cancellationToken);
        if (submission is null) return;

        var property = await _repo.GetPropertyWithInventoryAsync(propertyId, cancellationToken);
        ApplyInspectorDigest(dto, appraisal.PayloadJson, submission.PayloadJson, property);
    }

    /// <summary>
    /// List read: one batch (task facts, siblings, inspection packages, properties with inventory) for every
    /// appraisal package of the list; the dictionary is keyed by the appraisal task id.
    /// </summary>
    private async Task<IReadOnlyDictionary<Guid, (string PayloadJson, WorkOrderProperty? Property)>>
        LoadInspectorPackagesForAppraisalsAsync(
            IReadOnlyList<PartyTaskSubmission> entities,
            CancellationToken cancellationToken)
    {
        var result = new Dictionary<Guid, (string PayloadJson, WorkOrderProperty? Property)>();
        var appraisals = entities
            .Where(e => e.Kind == WorkflowTaskKindValues.PropertyAppraisal && e.PropertyId is not null)
            .ToList();
        if (appraisals.Count == 0) return result;

        var parentByTask = (await _repo.ListTaskFactsAsync(
                appraisals.Select(e => e.WorkflowTaskId).Distinct().ToList(), cancellationToken))
            .ToDictionary(t => t.Id, t => t.ParentTaskId);
        var parentIds = parentByTask.Values.Where(p => p is not null).Select(p => p!.Value).Distinct().ToList();
        var propertyIds = appraisals.Select(e => e.PropertyId!.Value).Distinct().ToList();
        if (parentIds.Count == 0) return result;

        var siblings = (await _repo.ListSiblingTasksAsync(parentIds, propertyIds, cancellationToken))
            .Where(t => t.ParentTaskId is not null && t.PropertyId is not null)
            .ToList();
        var inspectionByPair = siblings
            .GroupBy(t => (Parent: t.ParentTaskId!.Value, Property: t.PropertyId!.Value))
            .Select(g => (g.Key, Inspection: PickInspectionTask(g)))
            .Where(x => x.Inspection is not null)
            .ToDictionary(x => x.Key, x => x.Inspection!.Id);
        if (inspectionByPair.Count == 0) return result;

        var submissions = (await _repo.ListSubmissionsAsync(inspectionByPair.Values.ToList(), cancellationToken))
            .ToDictionary(s => s.WorkflowTaskId, s => s.PayloadJson);
        var properties = await _repo.ListPropertiesWithInventoryAsync(propertyIds, cancellationToken);

        foreach (var appraisal in appraisals)
        {
            if (parentByTask.GetValueOrDefault(appraisal.WorkflowTaskId) is not Guid parent) continue;
            if (!inspectionByPair.TryGetValue((parent, appraisal.PropertyId!.Value), out var inspectionId)) continue;
            if (!submissions.TryGetValue(inspectionId, out var payloadJson)) continue;
            result[appraisal.WorkflowTaskId] = (payloadJson, properties.GetValueOrDefault(appraisal.PropertyId.Value));
        }

        return result;
    }

    /// <summary>Best-effort wrapper for the save paths: the save already committed, an alert must not fail it.</summary>
    private Task AlertAppraiserInspectorDataChangedAsync(
        WorkflowTask task,
        string payloadBefore,
        string payloadAfter,
        CancellationToken cancellationToken) =>
        task.Kind == WorkflowTaskKind.FieldInspection
            ? BestEffortAsync(() =>
                NotifyAppraiserInspectorDataChangedAsync(task, payloadBefore, payloadAfter, cancellationToken))
            : Task.CompletedTask;

    /// <summary>Runs a post-commit side effect; a failure there never undoes or fails the committed work.</summary>
    private static async Task BestEffortAsync(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            // Notifications / timeline / audit are side effects of an already committed change.
        }
    }

    /// <summary>
    /// An inspector save that changed data the appraiser already acknowledged: tell the appraiser which
    /// sections moved. Only when the appraiser holds a baseline (<c>inspectorDataSeen</c>); the unread alert is
    /// deduped by its source event, so a burst of autosaves refreshes one notice instead of stacking.
    /// </summary>
    private async Task NotifyAppraiserInspectorDataChangedAsync(
        WorkflowTask inspectionTask,
        string payloadBefore,
        string payloadAfter,
        CancellationToken cancellationToken)
    {
        var changed = InspectorDataDigestRules.ChangedBetweenPayloads(payloadBefore, payloadAfter);
        if (changed.Count == 0) return;

        var appraisal = await FindSiblingAsync(inspectionTask, WorkflowTaskKind.PropertyAppraisal, cancellationToken);
        if (appraisal is null || appraisal.IsTerminal) return;

        var appraisalSubmission = await _repo.GetSubmissionAsync(appraisal.Id, track: false, cancellationToken);
        if (appraisalSubmission is null
            || string.IsNullOrWhiteSpace(PartyTaskSubmissionPayloadRules.ReadString(
                appraisalSubmission.PayloadJson, InspectorDataDigestRules.SeenPayloadKey)))
            return;

        var labels = changed
            .Select(g => InspectorDataGroupRules.Find(g)?.LabelAr ?? g)
            .ToList();
        var refLabel = inspectionTask.PoNumber?.Trim();
        var suffix = string.IsNullOrEmpty(refLabel) ? "" : $" على {refLabel}";

        // The appraiser already handed his package over: his data is locked and he cannot act, so the
        // specialist who now drafts the report (and may return the package) is the one to tell.
        if (appraisalSubmission.Status == PartyTaskSubmissionStatus.Submitted)
        {
            var parentTask = inspectionTask.ParentTaskId is Guid parentTaskId
                ? await _repo.GetTaskAsync(parentTaskId, cancellationToken)
                : null;
            if (parentTask is null) return;

            await NotifyPartyAssigneeAsync(
                parentTask,
                title: "تحديث في بيانات المعاينة بعد تسليم التقييم",
                body: $"حدّث المعاين بيانات المعاينة{suffix} ({string.Join("، ", labels)}) بعد أن سلّم المقيّم تقييمه — راجعها وأعد التقييم للمقيّم إن لزم.",
                tone: "warn",
                sourceEvent: $"inspector-data-changed-specialist:{appraisal.Id}",
                href: $"/case-study/{Uri.EscapeDataString(parentTask.Id.ToString())}",
                cancellationToken);
            return;
        }

        await NotifyPartyAssigneeAsync(
            appraisal,
            title: "تحديث في بيانات المعاينة",
            body: $"حدّث المعاين بيانات المعاينة{suffix} ({string.Join("، ", labels)}) — راجعها قبل المتابعة.",
            tone: "info",
            sourceEvent: $"inspector-data-changed-appraiser:{appraisal.Id}",
            href: $"/property-appraisal/{Uri.EscapeDataString(appraisal.Id.ToString())}",
            cancellationToken);
    }
}
