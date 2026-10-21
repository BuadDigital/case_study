using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Integration;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;

namespace RealEstateEval.Application.Tests;

public class ValuationIntegrationHandlerTests
{
  private static readonly Guid PropertyId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  private static readonly Guid AppraisalTaskId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

  [Fact]
  public async Task ValuationReportSubmitted_leaves_a_task_whose_package_was_never_submitted_open()
  {
    await using var db = CreateDb();
    SeedOpenAppraisalTask(db, packageStatus: PartyTaskSubmissionStatus.Draft);

    var handler = new ValuationReportWorkflowHandler(
      new ValuationReportWorkflowTaskLookup(TestInspectorFeeServiceFactory.ShareCaseStudy(db)),
      TestInspectorFeeServiceFactory.CreateWorkflow(db),
      NullLogger<ValuationReportWorkflowHandler>.Instance);

    await handler.HandleAsync(
      new ValuationReportSubmittedPayload(Guid.NewGuid(), PropertyId.ToString(), "VR-099", "عبدالله الكثيري"),
      CancellationToken.None);

    var task = await db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == AppraisalTaskId);
    Assert.Equal(WorkflowTaskStatus.Open, task.Status);
  }

  [Fact]
  public async Task ValuationReportSubmitted_completes_open_appraisal_task()
  {
    await using var db = CreateDb();
    SeedOpenAppraisalTask(db);

    var handler = new ValuationReportWorkflowHandler(
      new ValuationReportWorkflowTaskLookup(TestInspectorFeeServiceFactory.ShareCaseStudy(db)),
      TestInspectorFeeServiceFactory.CreateWorkflow(db),
      NullLogger<ValuationReportWorkflowHandler>.Instance);

    await handler.HandleAsync(
      new ValuationReportSubmittedPayload(
        Guid.NewGuid(),
        PropertyId.ToString(),
        "VR-100",
        "عبدالله الكثيري"),
      CancellationToken.None);

    var task = await db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == AppraisalTaskId);
    Assert.Equal(WorkflowTaskStatus.Completed, task.Status);
    Assert.Equal(WorkflowTaskPhase.Done, task.Phase);
  }

  [Fact]
  public async Task ValuationReportSubmitted_envelope_is_routed_by_event_type()
  {
    await using var db = CreateDb();
    SeedOpenAppraisalTask(db);

    var handler = new ValuationReportWorkflowHandler(
      new ValuationReportWorkflowTaskLookup(TestInspectorFeeServiceFactory.ShareCaseStudy(db)),
      TestInspectorFeeServiceFactory.CreateWorkflow(db),
      NullLogger<ValuationReportWorkflowHandler>.Instance);

    var envelope = new IntegrationEventEnvelope<ValuationReportSubmittedPayload>(
      Guid.NewGuid(),
      IntegrationEventTypes.ValuationReportSubmitted,
      DateTimeOffset.UtcNow,
      new ValuationReportSubmittedPayload(
        Guid.NewGuid(),
        PropertyId.ToString(),
        "VR-101",
        "عبدالله الكثيري"));

    await handler.HandleEnvelopeAsync(JsonSerializer.Serialize(envelope));

    var task = await db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == AppraisalTaskId);
    Assert.Equal(WorkflowTaskStatus.Completed, task.Status);
  }

  /// <summary>
  /// Phase 5 (decision 2026-10-19): one valuation per transaction — the final issuance on the holder
  /// deed also completes the other deeds' appraisal tasks, whose packages were never submitted.
  /// </summary>
  [Fact]
  public async Task ValuationReportSubmitted_completes_the_sibling_deeds_appraisal_tasks_too()
  {
    await using var db = CreateDb();
    SeedOpenAppraisalTask(db);
    var siblingProperty = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    var siblingTask = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    var transaction = Transaction.CreateDraft("TMP-26-00001", DateTime.UtcNow);
    transaction.StudyHolderPropertyId = PropertyId;
    db.Transactions.Add(transaction);
    db.WorkOrderProperties.AddRange(
      new WorkOrderProperty { Id = PropertyId, TransactionId = transaction.Id, DeedNumber = "1" },
      new WorkOrderProperty { Id = siblingProperty, TransactionId = transaction.Id, DeedNumber = "2" });
    db.WorkflowTasks.Add(WorkflowTask.Create(
      WorkflowTaskKind.PropertyAppraisal,
      "PO-101",
      DateTime.UtcNow,
      title: "تقييم العقار",
      phase: WorkflowTaskPhase.Done,
      id: siblingTask,
      propertyId: siblingProperty));
    db.SaveChanges();

    var handler = new ValuationReportWorkflowHandler(
      new ValuationReportWorkflowTaskLookup(TestInspectorFeeServiceFactory.ShareCaseStudy(db)),
      TestInspectorFeeServiceFactory.CreateWorkflow(db),
      NullLogger<ValuationReportWorkflowHandler>.Instance);

    await handler.HandleAsync(
      new ValuationReportSubmittedPayload(Guid.NewGuid(), PropertyId.ToString(), "VR-102", "عبدالله الكثيري"),
      CancellationToken.None);

    Assert.Equal(WorkflowTaskStatus.Completed, (await db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == AppraisalTaskId)).Status);
    Assert.Equal(WorkflowTaskStatus.Completed, (await db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == siblingTask)).Status);
  }

 /// <summary>
 /// D5 makes the outbox per-producer: the Valuation publisher must write through the Valuation
 /// context, and the row must be visible in the shared messaging table either way.
 /// </summary>
  [Fact]
  public async Task Valuation_outbox_publisher_queues_the_event_through_its_own_context()
  {
    await using var contexts = TestDatabases.Create("valuation-integration");
    var publisher = new ValuationOutboxPublisher(
      contexts.Valuation,
      NullLogger<ValuationOutboxPublisher>.Instance);

    await publisher.PublishAsync(
      IntegrationEventTypes.ValuationRequestCreated,
      new ValuationRequestCreatedPayload("vr-2", PropertyId.ToString(), "PO-300"));
    await contexts.Valuation.SaveChangesAsync();

    var row = await contexts.Messaging.OutboxMessages.SingleAsync();
    Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, row.EventType);
    Assert.Contains("PO-300", row.PayloadJson);
  }

  private static CaseStudyDbContext CreateDb()
  {
    var options = new DbContextOptionsBuilder<CaseStudyDbContext>()
      .UseInMemoryDatabase($"valuation-integration-{Guid.NewGuid():N}")
      .Options;
    return new CaseStudyDbContext(options);
  }

  /// <summary>An appraisal task handed over to the specialist: open, with the package in <paramref name="packageStatus"/>.</summary>
  private static void SeedOpenAppraisalTask(
    CaseStudyDbContext db,
    string packageStatus = PartyTaskSubmissionStatus.Submitted)
  {
    db.WorkflowTasks.Add(WorkflowTask.Create(
      WorkflowTaskKind.PropertyAppraisal,
      "PO-100",
      DateTime.UtcNow,
      title: "تقييم العقار",
      phase: WorkflowTaskPhase.Done,
      id: AppraisalTaskId,
      propertyId: PropertyId));
    var package = PartyTaskSubmission.CreateDraft(
      AppraisalTaskId, WorkflowTaskKindValues.PropertyAppraisal, PropertyId, "PO-100", DateTime.UtcNow);
    package.Status = packageStatus;
    db.PartyTaskSubmissions.Add(package);
    db.SaveChanges();
  }
}
