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

    var fees = new InspectorFeeService(db);
    var handler = new ValuationReportWorkflowHandler(
      db,
      new WorkflowTaskService(db, fees),
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
    Assert.Equal("done", task.Phase);
  }

  [Fact]
  public async Task ValuationReportSubmitted_envelope_is_routed_by_event_type()
  {
    await using var db = CreateDb();
    SeedOpenAppraisalTask(db);

    var fees = new InspectorFeeService(db);
    var handler = new ValuationReportWorkflowHandler(
      db,
      new WorkflowTaskService(db, fees),
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

  [Fact]
  public async Task ValuationRequestCreated_does_not_throw_when_no_appraisal_task()
  {
    await using var db = CreateDb();
    var handler = new ValuationRequestCreatedHandler(
      db,
      NullLogger<ValuationRequestCreatedHandler>.Instance);

    await handler.HandleAsync(
      new ValuationRequestCreatedPayload("vr-1", PropertyId.ToString(), "PO-200"),
      CancellationToken.None);
  }

  [Fact]
  public async Task Outbox_publisher_queues_valuation_event_json()
  {
    await using var db = CreateDb();
    var publisher = new OutboxIntegrationEventPublisher(
      db,
      NullLogger<OutboxIntegrationEventPublisher>.Instance);

    await publisher.PublishAsync(
      IntegrationEventTypes.ValuationRequestCreated,
      new ValuationRequestCreatedPayload("vr-2", PropertyId.ToString(), "PO-300"));
    await db.SaveChangesAsync();

    var row = await db.OutboxMessages.SingleAsync();
    Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, row.EventType);
    Assert.Contains("PO-300", row.PayloadJson);

    var createdHandler = new ValuationRequestCreatedHandler(
      db,
      NullLogger<ValuationRequestCreatedHandler>.Instance);
    await createdHandler.HandleEnvelopeAsync(row.PayloadJson);
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
    var now = DateTime.UtcNow;
    db.WorkflowTasks.Add(new WorkflowTask
    {
      Id = AppraisalTaskId,
      Kind = "property-appraisal",
      PoNumber = "PO-100",
      PropertyId = PropertyId,
      PropertyOrdinal = 1,
      Title = "تقييم العقار",
      Phase = "bourse",
      Status = WorkflowTaskStatus.Open,
      CreatedAtUtc = now,
      UpdatedAtUtc = now,
    });
    db.SaveChanges();
  }
}
