using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

public class FieldGapNotificationRulesTests
{
    private static readonly DateTime T0 = new(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);

    private static WorkflowTask Task(
        WorkflowTaskKind kind,
        WorkflowTaskStatus status,
        string? assigneeId,
        string assigneeName,
        int minutes) =>
        WorkflowTask.Create(
            kind,
            "PO-1",
            T0,
            status: status,
            assigneeName: assigneeName,
            assigneeId: assigneeId,
            updatedAtUtc: T0.AddMinutes(minutes));

    [Theory]
    [InlineData(null, "intake")]
    [InlineData("", "intake")]
    [InlineData(" Intake ", "intake")]
    [InlineData("inspector", "inspector")]
    [InlineData("SURVEY", "survey")]
    [InlineData("appraiser", null)]
    public void Normalizes_known_sources_and_rejects_others(string? raw, string? expected)
    {
        Assert.Equal(expected, FieldGapNotificationRules.NormalizeSource(raw));
    }

    [Fact]
    public void Each_source_maps_to_the_party_that_supplies_it()
    {
        Assert.Equal(WorkflowTaskKind.FieldInspection, FieldGapNotificationRules.TaskKind("inspector"));
        Assert.Equal(WorkflowTaskKind.EngineeringSurvey, FieldGapNotificationRules.TaskKind("survey"));
        Assert.Null(FieldGapNotificationRules.TaskKind("intake"));
        Assert.Equal("المعاين", FieldGapNotificationRules.RoleLabel("inspector"));
        Assert.Equal("نقص في بيانات الرفع المساحي", FieldGapNotificationRules.Title("survey"));
        Assert.Contains("أخصائي الإسناد", FieldGapNotificationRules.NoRecipientsError("intake"));
    }

    [Fact]
    public void A_completed_inspection_still_names_its_inspector_but_a_cancelled_one_does_not()
    {
        var tasks = new[]
        {
            Task(WorkflowTaskKind.FieldInspection, WorkflowTaskStatus.Completed, "fi-ahmed", "أحمد سعيد", 5),
            Task(WorkflowTaskKind.FieldInspection, WorkflowTaskStatus.Cancelled, "fi-old", "معاين سابق", 30),
            Task(WorkflowTaskKind.EngineeringSurvey, WorkflowTaskStatus.Open, null, "المكتب الهندسي", 40),
        };

        var inspector = FieldGapNotificationRules.ResponsibleTask(tasks, WorkflowTaskKind.FieldInspection);

        Assert.Equal("fi-ahmed", inspector?.AssigneeId);
        Assert.Null(FieldGapNotificationRules.ResponsibleTask(tasks, WorkflowTaskKind.EngineeringSurvey));
    }

    [Fact]
    public void Dedupes_per_source_property_and_field()
    {
        var id = Guid.Parse("11111111-2222-3333-4444-555555555555");
        Assert.Equal(
            "intake-field-gap:11111111222233334444555555555555:رقم الطلب",
            FieldGapNotificationRules.SourceEvent("intake", id, "رقم الطلب"));
        Assert.NotEqual(
            FieldGapNotificationRules.SourceEvent("intake", id, "x"),
            FieldGapNotificationRules.SourceEvent("survey", id, "x"));
    }
}
