using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class PartyTaskSubmissionService
{
    /// <summary>
    /// The case staff added photos to a sent field inspection, or removed ones they had added (Omar
    /// 2026-11-12): the property's timeline says so — «إضافة صور من الأخصائي» with the count and the name.
    /// How it works: compares the staff's photos in the payload before and after the correction
    /// (<see cref="StaffAddedPhotoRules.Change"/>) and records one row per direction that moved.
    /// Edge cases: a correction that touches no staff photo records nothing; a task with no property
    /// has no timeline; the row is a side effect of a saved correction, so a failure to record it never
    /// fails the save.
    /// </summary>
    private Task RecordStaffPhotoChangeAsync(
        WorkflowTask task,
        string? payloadBefore,
        string? payloadAfter,
        PartySubmissionActor? actor,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (task.Kind != WorkflowTaskKind.FieldInspection || task.PropertyId is not Guid propertyId)
            return Task.CompletedTask;

        var (added, removed) = StaffAddedPhotoRules.Change(payloadBefore, payloadAfter);
        if (added == 0 && removed == 0) return Task.CompletedTask;

        return BestEffortAsync(async () =>
        {
            if (added > 0)
            {
                await _timeline.RecordAsync(
                    task.PoNumber,
                    propertyId,
                    $"staff-photos:{task.Id}:added:{now.Ticks}",
                    StaffAddedPhotoRules.AddedTitleAr,
                    StaffAddedPhotoRules.TimelineDetail(added, actor?.DisplayName),
                    PropertyTimelineTones.Done,
                    now,
                    cancellationToken);
            }

            if (removed > 0)
            {
                await _timeline.RecordAsync(
                    task.PoNumber,
                    propertyId,
                    $"staff-photos:{task.Id}:removed:{now.Ticks}",
                    StaffAddedPhotoRules.RemovedTitleAr,
                    StaffAddedPhotoRules.TimelineDetail(removed, actor?.DisplayName),
                    PropertyTimelineTones.Warn,
                    now,
                    cancellationToken);
            }
        });
    }
}
