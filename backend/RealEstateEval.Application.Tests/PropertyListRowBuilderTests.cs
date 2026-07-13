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
    Assert.Equal("progress", row.Status);
    Assert.Equal("new", row.Survey);
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

    Assert.Equal("fail", Assert.Single(items).Row.Status);
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
        new WorkflowTask
        {
          Id = Guid.NewGuid(),
          Kind = "case-study-property",
          PoNumber = "PO-300",
          PropertyId = propertyId,
          Status = WorkflowTaskStatus.Completed,
          Phase = "done",
        },
      ],
    };

    var items = Infrastructure.Services.PropertyListRowBuilder.Build(
      [order],
      new HashSet<string>(StringComparer.Ordinal),
      tasksByProperty);

    var row = Assert.Single(items).Row;
    Assert.Equal("done", row.Status);
    Assert.Equal("done", row.Study);
  }
}
