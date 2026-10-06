using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The generic task patch must not move a case-study parent into or out of «completed» — that
/// is the issue / reopen of its report. Child kinds keep completing through it, and the
/// frontend's resolve-obstruction and suspend calls keep working.
/// </summary>
public class WorkflowTaskClientPatchRulesTests
{
    private const WorkflowTaskKind Parent = WorkflowTaskKind.CaseStudyProperty;

    private static string? Block(
        WorkflowTaskKind kind,
        WorkflowTaskStatus current,
        string? status = null,
        string? phase = null) =>
        WorkflowTaskLifecycleRules.ClientPatchBlockReason(
            kind, current, new PatchWorkflowTaskRequest { Status = status, Phase = phase });

    [Theory]
    [InlineData("completed", null)]
    [InlineData(null, "done")]
    [InlineData("completed", "done")]
    public void A_parent_cannot_be_completed_through_the_patch(string? status, string? phase)
    {
        foreach (var current in new[] { WorkflowTaskStatus.Open, WorkflowTaskStatus.Blocked })
        {
            Assert.Equal(
                WorkflowTaskLifecycleRules.CaseStudyParentPatchBlockedAr,
                Block(Parent, current, status, phase));
        }
    }

    [Fact]
    public void The_refusal_names_the_report_as_the_place_to_issue_and_reopen()
    {
        Assert.Equal(
            "يُنجز الإصدار وإعادة الفتح من تقرير دراسة الحالة",
            WorkflowTaskLifecycleRules.CaseStudyParentPatchBlockedAr);
    }

    [Fact]
    public void A_completed_parent_cannot_be_reopened_or_moved_out_of_done_through_the_patch()
    {
        var completed = WorkflowTaskStatus.Completed;
        Assert.NotNull(Block(Parent, completed, status: "open"));
        Assert.NotNull(Block(Parent, completed, status: "open", phase: "case-study"));
        Assert.NotNull(Block(Parent, completed, phase: "case-study"));
        Assert.NotNull(Block(Parent, completed, status: "blocked"));
        Assert.NotNull(Block(Parent, completed, status: "completed", phase: "case-study"));
    }

    [Fact]
    public void Repeating_the_completion_of_an_already_completed_parent_is_a_no_op_that_passes()
    {
        var completed = WorkflowTaskStatus.Completed;
        Assert.Null(Block(Parent, completed, status: "completed"));
        Assert.Null(Block(Parent, completed, phase: "done"));
        Assert.Null(Block(Parent, completed, status: "completed", phase: "done"));
    }

    [Fact]
    public void Resolving_an_obstruction_passes_status_open_on_a_parent_that_is_not_completed()
    {
        // resolveTaskObstruction: phase obstruction -> the phase it came from, status open.
        foreach (var phase in new[] { "enfath", "bourse", "distribution", "case-study" })
            Assert.Null(Block(Parent, WorkflowTaskStatus.Open, status: "open", phase: phase));
        Assert.Null(Block(Parent, WorkflowTaskStatus.Blocked, status: "open", phase: "bourse"));
    }

    [Fact]
    public void Suspending_a_parent_passes()
    {
        Assert.Null(Block(Parent, WorkflowTaskStatus.Open, status: "blocked"));
    }

    [Fact]
    public void A_patch_that_touches_neither_status_nor_phase_passes_even_on_a_completed_parent()
    {
        var request = new PatchWorkflowTaskRequest { Title = "دراسة حالة", AssigneeName = "أخصائي" };
        Assert.Null(WorkflowTaskLifecycleRules.ClientPatchBlockReason(
            Parent, WorkflowTaskStatus.Completed, request));
        Assert.Null(WorkflowTaskLifecycleRules.ClientPatchBlockReason(
            Parent, WorkflowTaskStatus.Open, request));
    }

    [Theory]
    [InlineData(WorkflowTaskKind.FieldInspection)]
    [InlineData(WorkflowTaskKind.EngineeringSurvey)]
    public void Inspection_and_survey_keep_completing_and_reopening_through_the_patch(WorkflowTaskKind kind)
    {
        Assert.Null(Block(kind, WorkflowTaskStatus.Open, status: "completed", phase: "done"));
        Assert.Null(Block(kind, WorkflowTaskStatus.Completed, status: "open", phase: "done"));
    }

    [Fact]
    public void The_appraisal_task_completes_only_with_the_final_issuance_and_reopens_only_as_a_new_version()
    {
        const WorkflowTaskKind appraisal = WorkflowTaskKind.PropertyAppraisal;
        Assert.Equal(
            WorkflowTaskLifecycleRules.AppraisalPatchBlockedAr,
            Block(appraisal, WorkflowTaskStatus.Open, status: "completed", phase: "done"));
        Assert.Equal(
            WorkflowTaskLifecycleRules.AppraisalPatchBlockedAr,
            Block(appraisal, WorkflowTaskStatus.Completed, status: "open", phase: "done"));
        // A repeated completion, a suspension of an open task and a title edit are untouched.
        Assert.Null(Block(appraisal, WorkflowTaskStatus.Completed, status: "completed"));
        Assert.Null(Block(appraisal, WorkflowTaskStatus.Open, status: "blocked"));
        Assert.Null(Block(appraisal, WorkflowTaskStatus.Open, status: "open", phase: "done"));
    }
}
