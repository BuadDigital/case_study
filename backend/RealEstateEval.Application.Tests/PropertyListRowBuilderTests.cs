using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class PropertyListRowBuilderTests
{
  [Fact]
  public void Build_marks_bourse_pending_properties_as_progress()
  {
    var order = new WorkOrder
    {
      PoNumber = "PO-100",
      AssignmentSpecialist = "أحمد",
      Properties =
      [
        new WorkOrderProperty
        {
          Id = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
          IdentifierType = PropertyIdentifierType.Deed,
          DeedNumber = "123",
          City = "مكة",
          District = "العزيزية",
          Classification = "أرض",
          PropertyType = "أرض",
          BourseDataCompleted = false,
        },
      ],
    };

    var items = Infrastructure.Services.PropertyListRowBuilder.Build(
      [order],
      new HashSet<string>(StringComparer.Ordinal));

    var row = Assert.Single(items).Row;
    Assert.Equal("بانتظار البورصة", row.Area);
    Assert.Equal(PropertyListRowStatuses.Progress, row.Status);
    Assert.Equal(PropertyListRowStatuses.New, row.Survey);
  }

  [Fact]
  public void Build_marks_approved_failure_as_fail()
  {
    var propertyId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    var order = new WorkOrder
    {
      PoNumber = "PO-200",
      Properties =
      [
        new WorkOrderProperty
        {
          Id = propertyId,
          IdentifierType = PropertyIdentifierType.Deed,
          DeedNumber = "456",
          City = "جدة",
          Classification = "أرض",
          PropertyType = "أرض",
          BourseDataCompleted = true,
        },
      ],
    };

    var failureKeys = new HashSet<string>(StringComparer.Ordinal)
    {
      $"PO-200|{propertyId}",
    };

    var items = Infrastructure.Services.PropertyListRowBuilder.Build(
      [order],
      failureKeys);

    Assert.Equal(PropertyListRowStatuses.Fail, Assert.Single(items).Row.Status);
  }

  [Fact]
  public void Build_marks_completed_case_study_as_done()
  {
    var propertyId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    var order = new WorkOrder
    {
      PoNumber = "PO-300",
      Properties =
      [
        new WorkOrderProperty
        {
          Id = propertyId,
          IdentifierType = PropertyIdentifierType.Deed,
          DeedNumber = "789",
          City = "الرياض",
          Classification = "أرض",
          PropertyType = "أرض",
          BourseDataCompleted = true,
        },
      ],
    };

    var tasksByProperty = new Dictionary<Guid, IReadOnlyList<WorkflowTask>>
    {
      [propertyId] =
      [
        Task(
          WorkflowTaskKind.CaseStudyProperty,
          "PO-300",
          propertyId,
          WorkflowTaskStatus.Completed,
          WorkflowTaskPhase.Done),
      ],
    };

    var items = Infrastructure.Services.PropertyListRowBuilder.Build(
      [order],
      new HashSet<string>(StringComparer.Ordinal),
      tasksByProperty);

    var row = Assert.Single(items).Row;
    Assert.Equal(PropertyListRowStatuses.Done, row.Status);
    Assert.Equal(PropertyListRowStatuses.Done, row.Study);
  }

  [Fact]
  public void Build_does_not_mark_done_when_only_party_tasks_completed()
  {
    var propertyId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    var parentId = Guid.NewGuid();
    var order = new WorkOrder
    {
      PoNumber = "PO-400",
      Properties =
      [
        new WorkOrderProperty
        {
          Id = propertyId,
          IdentifierType = PropertyIdentifierType.Deed,
          DeedNumber = "999",
          City = "الدمام",
          Classification = "أرض",
          PropertyType = "أرض",
          BourseDataCompleted = true,
        },
      ],
    };

    var tasksByProperty = new Dictionary<Guid, IReadOnlyList<WorkflowTask>>
    {
      [propertyId] =
      [
        Task(
          WorkflowTaskKind.CaseStudyProperty,
          "PO-400",
          propertyId,
          WorkflowTaskStatus.Open,
          WorkflowTaskPhase.CaseStudy,
          id: parentId),
        Task(
          WorkflowTaskKind.FieldInspection,
          "PO-400",
          propertyId,
          WorkflowTaskStatus.Completed,
          WorkflowTaskPhase.Done,
          parentTaskId: parentId),
        Task(
          WorkflowTaskKind.PropertyAppraisal,
          "PO-400",
          propertyId,
          WorkflowTaskStatus.Completed,
          WorkflowTaskPhase.Done,
          parentTaskId: parentId),
      ],
    };

    var items = Infrastructure.Services.PropertyListRowBuilder.Build(
      [order],
      new HashSet<string>(StringComparer.Ordinal),
      tasksByProperty);

    var row = Assert.Single(items).Row;
    Assert.Equal(PropertyListRowStatuses.Progress, row.Status);
    Assert.Equal(PropertyListRowStatuses.Progress, row.Study);
  }

  private static WorkflowTask Task(
    WorkflowTaskKind kind,
    string poNumber,
    Guid propertyId,
    WorkflowTaskStatus status,
    WorkflowTaskPhase phase,
    Guid? id = null,
    Guid? parentTaskId = null) =>
    WorkflowTask.Create(
      kind,
      poNumber,
      DateTime.UtcNow,
      phase: phase,
      status: status,
      id: id,
      propertyId: propertyId,
      parentTaskId: parentTaskId);
}
