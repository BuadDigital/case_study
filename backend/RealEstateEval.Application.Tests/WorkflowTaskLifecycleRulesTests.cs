using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class WorkflowTaskLifecycleRulesTests
{
    private static readonly DateTime Now = new(2026, 9, 6, 9, 0, 0, DateTimeKind.Utc);

    private static WorkflowTask MakeTask(
        WorkflowTaskKind kind = WorkflowTaskKind.CaseStudyProperty,
        Guid? id = null,
        Guid? propertyId = null,
        Guid? parentTaskId = null,
        string? assigneeId = null,
        WorkflowTaskPhase phase = WorkflowTaskPhase.Enfath,
        WorkflowTaskStatus status = WorkflowTaskStatus.Open,
        string assigneeRole = StaffRoleIds.CaseSpecialist,
        int ordinal = 1) =>
        WorkflowTask.Create(
            kind,
            "PO-1",
            Now,
            phase: phase,
            status: status,
            assigneeRole: assigneeRole,
            id: id,
            propertyId: propertyId,
            propertyOrdinal: ordinal,
            assigneeId: assigneeId,
            parentTaskId: parentTaskId);

    // ---- supervisor gate + reason ----

    [Theory]
    [InlineData("section-supervisor", true)]
    [InlineData(" General-Manager ", true)]
    [InlineData("cdo", true)]
    [InlineData("case-specialist", false)]
    [InlineData(null, false)]
    public void Section_supervisor_or_above_is_case_insensitive_and_trimmed(string? role, bool expected)
    {
        Assert.Equal(expected, WorkflowTaskLifecycleRules.IsSectionSupervisorOrAbove(role));
    }

    [Fact]
    public void Reason_must_be_present_and_at_most_500_characters()
    {
        var missing = WorkflowTaskLifecycleRules.ReasonError(
            WorkflowTaskLifecycleRules.NormalizeReason("   "), "مطلوب", "طويل");
        Assert.Equal("مطلوب", missing!["reason"]);

        var tooLong = WorkflowTaskLifecycleRules.ReasonError(new string('x', 501), "مطلوب", "طويل");
        Assert.Equal("طويل", tooLong!["reason"]);

        Assert.Null(WorkflowTaskLifecycleRules.ReasonError(new string('x', 500), "مطلوب", "طويل"));
    }

    // ---- titles + revert ----

    [Fact]
    public void Distribution_title_prefers_the_deed_over_the_po()
    {
        Assert.Equal("توزيع الأطراف — D-9", WorkflowTaskLifecycleRules.DistributionPhaseTitle("D-9", "PO-1"));
        Assert.Equal("توزيع الأطراف — PO-1", WorkflowTaskLifecycleRules.DistributionPhaseTitle("", "PO-1"));
    }

    [Theory]
    [InlineData(" Enfath ", true, WorkflowTaskPhase.Enfath)]
    [InlineData("bourse", true, WorkflowTaskPhase.Bourse)]
    [InlineData("distribution", false, default(WorkflowTaskPhase))]
    [InlineData("nonsense", false, default(WorkflowTaskPhase))]
    [InlineData(null, false, default(WorkflowTaskPhase))]
    public void Only_the_two_pre_study_phases_are_revert_targets(
        string? wire,
        bool expected,
        WorkflowTaskPhase expectedTarget)
    {
        var ok = WorkflowTaskLifecycleRules.TryParseRevertTarget(wire, out var target);

        Assert.Equal(expected, ok);
        if (ok) Assert.Equal(expectedTarget, target);
    }

    [Fact]
    public void Revert_timeline_label_names_the_target_phase()
    {
        Assert.Equal("إرجاع للبيانات الأولية", WorkflowTaskLifecycleRules.RevertTimelineLabel(WorkflowTaskPhase.Enfath));
        Assert.Equal("إرجاع لاستعلام البورصة", WorkflowTaskLifecycleRules.RevertTimelineLabel(WorkflowTaskPhase.Bourse));
    }

    // ---- patch follow-ups ----

    [Fact]
    public void Completed_case_study_requires_the_parent_kind_and_completed_status()
    {
        Assert.True(WorkflowTaskLifecycleRules.IsCompletedCaseStudy(MakeTask(status: WorkflowTaskStatus.Completed)));
        Assert.False(WorkflowTaskLifecycleRules.IsCompletedCaseStudy(MakeTask()));
        Assert.False(WorkflowTaskLifecycleRules.IsCompletedCaseStudy(
            MakeTask(kind: WorkflowTaskKind.FieldInspection, status: WorkflowTaskStatus.Completed)));
    }

    [Fact]
    public void Specialist_is_notified_after_unblock_or_reassignment_only()
    {
        var specialist = MakeTask(assigneeId: "cs-1");

        Assert.True(WorkflowTaskLifecycleRules.ShouldNotifySpecialistReturned(specialist, wasBlocked: true, "cs-1"));
        Assert.True(WorkflowTaskLifecycleRules.ShouldNotifySpecialistReturned(specialist, wasBlocked: false, "cs-0"));
        Assert.False(WorkflowTaskLifecycleRules.ShouldNotifySpecialistReturned(specialist, wasBlocked: false, "cs-1"));

        var inspector = MakeTask(assigneeId: "fi-1", assigneeRole: StaffRoleIds.FieldInspector);
        Assert.False(WorkflowTaskLifecycleRules.ShouldNotifySpecialistReturned(inspector, wasBlocked: true, "fi-1"));

        var blocked = MakeTask(assigneeId: "cs-1", status: WorkflowTaskStatus.Blocked);
        Assert.False(WorkflowTaskLifecycleRules.ShouldNotifySpecialistReturned(blocked, wasBlocked: true, "cs-0"));
    }

    // ---- cascades ----

    [Fact]
    public void Distinct_assignee_ids_are_trimmed_deduplicated_and_skip_blanks()
    {
        var ids = WorkflowTaskLifecycleRules.DistinctAssigneeIds(
        [
            MakeTask(assigneeId: " fi-1 "),
            MakeTask(assigneeId: "fi-1"),
            MakeTask(assigneeId: null),
            MakeTask(assigneeId: "eo-2"),
        ]);

        Assert.Equal(["fi-1", "eo-2"], ids);
    }

    [Fact]
    public void Slot_cascade_takes_the_slot_its_children_and_same_property_tasks()
    {
        var propertyId = Guid.NewGuid();
        var slot = MakeTask(propertyId: propertyId);
        var child = MakeTask(kind: WorkflowTaskKind.FieldInspection, parentTaskId: slot.Id);
        var sameProperty = MakeTask(kind: WorkflowTaskKind.PropertyAppraisal, propertyId: propertyId);
        var other = MakeTask(propertyId: Guid.NewGuid(), ordinal: 2);

        var removed = WorkflowTaskLifecycleRules.SlotCascadeTasks([slot, child, sameProperty, other], slot);

        Assert.Equal([slot.Id, child.Id, sameProperty.Id], removed.Select(t => t.Id));
    }

    [Fact]
    public void Slot_cascade_always_contains_the_slot_even_when_the_po_list_misses_it()
    {
        var slot = MakeTask();

        var removed = WorkflowTaskLifecycleRules.SlotCascadeTasks([MakeTask(ordinal: 2)], slot);

        Assert.Single(removed);
        Assert.Same(slot, removed[0]);
    }

    [Fact]
    public void Excess_empty_slots_are_unlinked_enfath_slots_past_the_expected_count()
    {
        var keep = MakeTask(ordinal: 2);
        var excess = MakeTask(ordinal: 3);
        var linkedExcess = MakeTask(ordinal: 4, propertyId: Guid.NewGuid());
        var bourseExcess = MakeTask(ordinal: 5, phase: WorkflowTaskPhase.Bourse);

        var result = WorkflowTaskLifecycleRules.ExcessEmptySlots([keep, excess, linkedExcess, bourseExcess], 2);

        Assert.Equal([excess.Id], result.Select(t => t.Id));
    }

    [Fact]
    public void Property_cascade_keeps_the_linked_slot_and_removes_its_children_and_property_tasks()
    {
        var propertyId = Guid.NewGuid();
        var slot = MakeTask(propertyId: propertyId);
        var child = MakeTask(kind: WorkflowTaskKind.FieldInspection, parentTaskId: slot.Id);
        var loose = MakeTask(kind: WorkflowTaskKind.EngineeringSurvey, propertyId: propertyId);
        var other = MakeTask(ordinal: 2);
        var list = new List<WorkflowTask> { slot, child, loose, other };

        var linked = WorkflowTaskLifecycleRules.LinkedSlot(list, propertyId);
        var removed = WorkflowTaskLifecycleRules.PropertyCascadeTasks(list, propertyId, linked);

        Assert.Same(slot, linked);
        Assert.Equal([child.Id, loose.Id], removed.Select(t => t.Id));
    }

    [Fact]
    public void Property_cascade_without_a_slot_removes_every_property_task_and_their_children()
    {
        var propertyId = Guid.NewGuid();
        var inspection = MakeTask(kind: WorkflowTaskKind.FieldInspection, propertyId: propertyId);
        var childOfInspection = MakeTask(kind: WorkflowTaskKind.EngineeringSurvey, parentTaskId: inspection.Id);
        var unrelated = MakeTask(kind: WorkflowTaskKind.PropertyAppraisal, propertyId: Guid.NewGuid());
        var list = new List<WorkflowTask> { inspection, childOfInspection, unrelated };

        Assert.Null(WorkflowTaskLifecycleRules.LinkedSlot(list, propertyId));
        var removed = WorkflowTaskLifecycleRules.PropertyCascadeTasks(list, propertyId, null);

        Assert.Equal([inspection.Id, childOfInspection.Id], removed.Select(t => t.Id));
    }

    [Fact]
    public void Field_inspection_task_ids_come_from_inspection_submissions_only()
    {
        var inspectionTask = Guid.NewGuid();
        var ids = WorkflowTaskLifecycleRules.FieldInspectionTaskIds(
        [
            new PartyTaskSubmission { WorkflowTaskId = inspectionTask, Kind = WorkflowTaskKindValues.FieldInspection },
            new PartyTaskSubmission { WorkflowTaskId = Guid.NewGuid(), Kind = WorkflowTaskKindValues.EngineeringSurvey },
        ]);

        Assert.Equal([inspectionTask], ids);
    }
}
