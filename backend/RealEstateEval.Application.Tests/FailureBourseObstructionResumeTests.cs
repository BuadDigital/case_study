using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FailureBourseObstructionResumeTests
{
    private static readonly Guid FailureId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid PropertyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid TaskId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private const string PoNumber = "PO-BOURSE-1";

    [Fact]
    public async Task Resolve_after_distribution_drift_resumes_bourse_and_clears_completion()
    {
        var bundle = await SeedScenarioAsync(
            bourseDataCompleted: true,
            taskPhase: WorkflowTaskPhase.Distribution,
            taskStatus: WorkflowTaskStatus.Blocked,
            obstructionPriorPhase: WorkflowTaskPhase.Bourse);

        var service = TestBoundedContexts.CreateFailureService(bundle);
        var dto = await service.ResolveAsync(
            FailureId,
            new ResolveFailureRequest
            {
                ResolutionReason = "تم التحقق",
                ContinueInstructions = "أكمل استعلام البورصة",
            });

        Assert.NotNull(dto);
        Assert.Equal(PropertyFailureStatus.Resolved, dto!.Status);

        var task = await bundle.App.WorkflowTasks.AsNoTracking()
            .SingleAsync(t => t.Id == TaskId);
        Assert.Equal(WorkflowTaskPhase.Bourse, task.Phase);
        Assert.Equal(WorkflowTaskStatus.Open, task.Status);
        Assert.Null(task.ObstructionPriorPhase);

        var property = await bundle.App.WorkOrderProperties.AsNoTracking()
            .SingleAsync(p => p.Id == PropertyId);
        Assert.False(property.BourseDataCompleted);
        Assert.Null(property.BourseCompletedAtUtc);
    }

    [Fact]
    public async Task Resolve_while_still_in_obstruction_resumes_bourse_queue()
    {
        var bundle = await SeedScenarioAsync(
            bourseDataCompleted: true,
            taskPhase: WorkflowTaskPhase.Obstruction,
            taskStatus: WorkflowTaskStatus.Blocked,
            obstructionPriorPhase: WorkflowTaskPhase.Bourse);

        var service = TestBoundedContexts.CreateFailureService(bundle);
        var dto = await service.ResolveAsync(
            FailureId,
            new ResolveFailureRequest
            {
                ResolutionReason = "تم التحقق",
                ContinueInstructions = "أكمل استعلام البورصة",
            });

        Assert.NotNull(dto);

        var pending = await ListPendingBourseAsync(bundle);
        Assert.Contains(pending, p => p.PropertyId == PropertyId);
    }

    [Fact]
    public async Task AdvanceAfterBourse_is_noop_when_task_blocked()
    {
        var bundle = await SeedScenarioAsync(
            bourseDataCompleted: true,
            taskPhase: WorkflowTaskPhase.Bourse,
            taskStatus: WorkflowTaskStatus.Blocked,
            obstructionPriorPhase: WorkflowTaskPhase.Bourse,
            seedFailure: false);

        var tasks = TestInspectorFeeServiceFactory.CreateWorkflow(bundle.App);
        var dto = await tasks.AdvanceAfterBourseAsync(
            TaskId,
            new AdvanceTaskAfterBourseRequest { DeedNumber = "DEED-1" });

        Assert.NotNull(dto);
        Assert.Equal(WorkflowTaskPhaseValues.Bourse, dto!.Phase);

        var task = await bundle.App.WorkflowTasks.AsNoTracking()
            .SingleAsync(t => t.Id == TaskId);
        Assert.Equal(WorkflowTaskPhase.Bourse, task.Phase);
        Assert.Equal(WorkflowTaskStatus.Blocked, task.Status);
    }

    private static async Task<TestBoundedContexts.Bundle> SeedScenarioAsync(
        bool bourseDataCompleted,
        WorkflowTaskPhase taskPhase,
        WorkflowTaskStatus taskStatus,
        WorkflowTaskPhase obstructionPriorPhase,
        bool seedFailure = true)
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var workOrderId = Guid.NewGuid();
        db.WorkOrders.Add(new WorkOrder
        {
            Id = workOrderId,
            PoNumber = PoNumber,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(DateTime.UtcNow),
            DueDateAt = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            CreatedAtUtc = DateTime.UtcNow,
        });
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = workOrderId,
            IdentifierType = PropertyIdentifierType.Deed,
            DeedNumber = "DEED-1",
            City = "الرياض",
            Classification = "سكني",
            PropertyType = "فيلا",
            BoundariesAvailability = "no",
            BourseDataCompleted = bourseDataCompleted,
            BourseCompletedAtUtc = bourseDataCompleted ? DateTime.UtcNow : null,
        });

        var task = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            PoNumber,
            DateTime.UtcNow,
            phase: taskPhase,
            status: taskStatus,
            id: TaskId,
            propertyId: PropertyId);
        task.ApplyShellPatch(
            phase: taskPhase,
            status: taskStatus,
            title: null,
            assigneeRole: null,
            assigneeName: null,
            assigneeId: null,
            assigneeIdProvided: false,
            propertyId: PropertyId,
            propertyIdProvided: false,
            obstructionReason: "تعذر",
            obstructionReasonProvided: true,
            obstructionPriorPhase: obstructionPriorPhase,
            obstructionPriorPhaseProvided: true,
            distributionJson: null,
            nowUtc: DateTime.UtcNow);
        db.WorkflowTasks.Add(task);

        if (seedFailure)
        {
            var now = DateTime.UtcNow;
            bundle.Failures.PropertyFailures.Add(PropertyFailure.Reconstitute(
                FailureId,
                PoNumber,
                PropertyId.ToString(),
                "DEED-1",
                "عدم معرفة حدود العقار",
                "unknown-boundaries",
                "internal",
                "النظام",
                "توفر الحدود = غير متوفرة حسب استعلام البورصة.",
                "",
                PropertyFailureStatus.Internal,
                "specialist",
                now,
                now));
        }

        await db.SaveChangesAsync();
        await bundle.Failures.SaveChangesAsync();
        return bundle;
    }

    private static async Task<IReadOnlyList<PendingBoursePropertyDto>> ListPendingBourseAsync(
        TestBoundedContexts.Bundle bundle)
    {
        var caseStudy = TestInspectorFeeServiceFactory.ShareCaseStudy(bundle.App);
        var failures = bundle.Failures;
        var financial = TestInspectorFeeServiceFactory.ShareFinancial(bundle.App);
        var identity = TestInspectorFeeServiceFactory.ShareIdentity(bundle.App);
        var loader = new WorkOrderLoader(caseStudy);
        var query = new WorkOrderQueryService(caseStudy, new FailureLookup(failures), new PoEnfazInvoiceLookup(financial), new UserLabelLookup(identity), loader);
        return await query.ListPendingBourseAsync(CancellationToken.None);
    }

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"failure-bourse-resume-{Guid.NewGuid():N}");
}
