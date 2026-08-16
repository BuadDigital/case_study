using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

public class ValuationIntegrationHandlerTests
{
  private static readonly Guid PropertyId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  private static readonly Guid AppraisalTaskId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

  [Fact]
  public async Task ValuationReportSubmitted_completes_open_appraisal_task()
  {
    await using var db = CreateDb();
    SeedOpenAppraisalTask(db);

    var handler = new ValuationReportWorkflowHandler(
      db,
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
      db,
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

    var row = await contexts.Legacy.OutboxMessages.SingleAsync();
    Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, row.EventType);
    Assert.Contains("PO-300", row.PayloadJson);
  }

  private static ApplicationDbContext CreateDb()
  {
    var options = new DbContextOptionsBuilder<ApplicationDbContext>()
      .UseInMemoryDatabase($"valuation-integration-{Guid.NewGuid():N}")
      .Options;
    return new ApplicationDbContext(options);
  }

  private static void SeedOpenAppraisalTask(ApplicationDbContext db)
  {
    db.WorkflowTasks.Add(WorkflowTask.Create(
      WorkflowTaskKind.PropertyAppraisal,
      "PO-100",
      DateTime.UtcNow,
      title: "تقييم العقار",
      phase: WorkflowTaskPhase.Done,
      id: AppraisalTaskId,
      propertyId: PropertyId));
    db.SaveChanges();
  }
}
