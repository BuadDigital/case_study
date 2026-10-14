using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// <c>reopen-completed</c> must not leave «parent open + report issued»: for a case-study parent it
/// points at the report's own reopen action, while party tasks still reopen as before.
/// </summary>
public class WorkflowTaskReopenCompletedStudyParentTests
{
    private static readonly Guid ParentId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly Guid InspectionId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid PropertyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    [Fact]
    public async Task A_completed_case_study_parent_is_refused_with_a_pointer_to_the_report_reopen()
    {
        await using var contexts = TestDatabases.Create("reopen-completed-parent");
        Seed(contexts);
        var tasks = TestInspectorFeeServiceFactory.CreateWorkflow(contexts.CaseStudy);

        var (result, errors) = await tasks.ReopenCompletedAsync(
            ParentId,
            new ReopenCompletedWorkflowTaskRequest { Reason = "سبب كافٍ لإعادة الفتح" },
            "section-supervisor",
            "المشرف",
            "supervisor-1");

        Assert.Null(result);
        Assert.Equal(WorkflowTaskLifecycleCommands.CaseStudyParentReopenViaReportAr, errors!["_"]);
        Assert.Contains("تقرير دراسة الحالة", errors["_"]);

        var parent = await contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == ParentId);
        Assert.Equal(WorkflowTaskStatus.Completed, parent.Status);
        Assert.Equal(WorkflowTaskPhase.Done, parent.Phase);
    }

    [Fact]
    public async Task A_completed_party_task_still_reopens_through_the_generic_route()
    {
        await using var contexts = TestDatabases.Create("reopen-completed-party");
        Seed(contexts);
        var tasks = TestInspectorFeeServiceFactory.CreateWorkflow(contexts.CaseStudy);

        var (result, errors) = await tasks.ReopenCompletedAsync(
            InspectionId,
            new ReopenCompletedWorkflowTaskRequest { Reason = "سبب كافٍ لإعادة الفتح" },
            "section-supervisor",
            "المشرف",
            "supervisor-1");

        Assert.Null(errors);
        Assert.Equal("open", result!.Status);
    }

    [Fact]
    public async Task A_completed_appraisal_task_is_refused_with_a_pointer_to_the_package_return()
    {
        await using var contexts = TestDatabases.Create("reopen-completed-appraisal");
        Seed(contexts);
        var appraisalId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        contexts.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.PropertyAppraisal, "PO-RC", DateTime.UtcNow, title: "تقييم",
            phase: WorkflowTaskPhase.Done, status: WorkflowTaskStatus.Completed,
            id: appraisalId, propertyId: PropertyId, parentTaskId: ParentId));
        contexts.CaseStudy.SaveChanges();
        var tasks = TestInspectorFeeServiceFactory.CreateWorkflow(contexts.CaseStudy);

        var (result, errors) = await tasks.ReopenCompletedAsync(
            appraisalId,
            new ReopenCompletedWorkflowTaskRequest { Reason = "سبب كافٍ لإعادة الفتح" },
            "section-supervisor",
            "المشرف",
            "supervisor-1");

        Assert.Null(result);
        Assert.Equal(WorkflowTaskLifecycleCommands.AppraisalReopenViaPackageAr, errors!["_"]);
        var task = await contexts.CaseStudy.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == appraisalId);
        Assert.Equal(WorkflowTaskStatus.Completed, task.Status);
    }

    [Fact]
    public async Task The_supervisor_rule_still_comes_first()
    {
        await using var contexts = TestDatabases.Create("reopen-completed-role");
        Seed(contexts);
        var tasks = TestInspectorFeeServiceFactory.CreateWorkflow(contexts.CaseStudy);

        var (_, errors) = await tasks.ReopenCompletedAsync(
            ParentId,
            new ReopenCompletedWorkflowTaskRequest { Reason = "سبب كافٍ لإعادة الفتح" },
            "field-inspector",
            "معاين");

        Assert.NotNull(errors);
        Assert.NotEqual(WorkflowTaskLifecycleCommands.CaseStudyParentReopenViaReportAr, errors["_"]);
    }

    private static void Seed(TestDatabases.ContextSet contexts)
    {
        var now = DateTime.UtcNow;
        contexts.CaseStudy.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, "PO-RC", now, title: "دراسة",
                phase: WorkflowTaskPhase.Done, status: WorkflowTaskStatus.Completed,
                id: ParentId, propertyId: PropertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection, "PO-RC", now, title: "معاينة",
                phase: WorkflowTaskPhase.Done, status: WorkflowTaskStatus.Completed,
                id: InspectionId, propertyId: PropertyId, parentTaskId: ParentId));
        contexts.CaseStudy.SaveChanges();
    }
}
