using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class WorkflowTaskDistributionRulesTests
{
    private static readonly DateTime Now = new(2026, 9, 6, 9, 0, 0, DateTimeKind.Utc);

    private static WorkflowTask Parent(Guid? propertyId = null) =>
        WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-7",
            Now,
            phase: WorkflowTaskPhase.Distribution,
            assigneeName: "سارة",
            propertyId: propertyId ?? Guid.NewGuid());

    private static WorkflowTask Child(WorkflowTask parent, WorkflowTaskKind kind, string? assigneeId) =>
        WorkflowTask.CreatePartyChild(parent, kind, StaffRoleIds.FieldInspector, "طرف", assigneeId, "t", Now);

    private static TaskDistributionDraftDto Draft() => new()
    {
        InspectorId = "fi-1",
        ValuatorId = "va-1",
        CaseSpecialistId = "cs-1",
        EngineeringOffice = true,
        EngineeringOfficeId = "eo-1",
    };

    // ---- confirm defaults + assignee checks ----

    [Fact]
    public void Confirm_defaults_force_specialist_and_valuation_and_drop_the_office_without_a_survey()
    {
        var withSurvey = WorkflowTaskDistributionRules.ApplyConfirmDefaults(Draft(), propertyRequiresSurvey: true);
        Assert.True(withSurvey.ValuationDepartment);
        Assert.True(withSurvey.CaseSpecialist);
        Assert.True(withSurvey.EngineeringOffice);
        Assert.Equal("eo-1", withSurvey.EngineeringOfficeId);

        var noSurvey = WorkflowTaskDistributionRules.ApplyConfirmDefaults(Draft(), propertyRequiresSurvey: false);
        Assert.False(noSurvey.EngineeringOffice);
        Assert.Equal("", noSurvey.EngineeringOfficeId);
    }

    [Fact]
    public void Missing_assignees_are_reported_specialist_first()
    {
        Assert.Null(WorkflowTaskDistributionRules.ConfirmAssigneeError(Draft()));

        var noSpecialist = Draft();
        noSpecialist.CaseSpecialistId = " ";
        noSpecialist.InspectorId = "";
        Assert.Equal("اختر أخصائي دراسة الحالة.", WorkflowTaskDistributionRules.ConfirmAssigneeError(noSpecialist));

        var noInspector = Draft();
        noInspector.InspectorId = "";
        Assert.Equal("اختر المعاين الميداني.", WorkflowTaskDistributionRules.ConfirmAssigneeError(noInspector));

        var noValuator = Draft();
        noValuator.ValuatorId = "";
        Assert.Equal("اختر المقيم العقاري.", WorkflowTaskDistributionRules.ConfirmAssigneeError(noValuator));
    }

    [Fact]
    public void Party_children_are_inspector_then_appraiser_then_optional_office()
    {
        var specs = WorkflowTaskDistributionRules.PartyChildren(Draft());

        Assert.Equal(
            [WorkflowTaskKind.FieldInspection, WorkflowTaskKind.PropertyAppraisal, WorkflowTaskKind.EngineeringSurvey],
            specs.Select(s => s.Kind));
        Assert.All(specs, s => Assert.True(s.Enabled));
        Assert.Equal(["fi-1", "va-1", "eo-1"], specs.Select(s => s.AssigneeId));
        Assert.Equal([StaffRoleIds.FieldInspector, StaffRoleIds.RealEstateAppraiser, StaffRoleIds.EngineeringOffice],
            specs.Select(s => s.Role));

        var noOffice = Draft();
        noOffice.EngineeringOffice = false;
        Assert.False(WorkflowTaskDistributionRules.PartyChildren(noOffice)[2].Enabled);
    }

    // ---- names + labels ----

    [Fact]
    public void Specialist_name_falls_back_from_kind_key_to_role_key_to_default()
    {
        Assert.Equal("أحمد", WorkflowTaskDistributionRules.ResolveSpecialistName(
            new() { [WorkflowTaskKindValues.CaseStudyProperty] = " أحمد ", [StaffRoleIds.CaseSpecialist] = "خالد" }));
        Assert.Equal("خالد", WorkflowTaskDistributionRules.ResolveSpecialistName(
            new() { [WorkflowTaskKindValues.CaseStudyProperty] = "  ", [StaffRoleIds.CaseSpecialist] = "خالد" }));
        Assert.Equal("أخصائي دراسة حالة", WorkflowTaskDistributionRules.ResolveSpecialistName(new()));
    }

    [Fact]
    public void Titles_and_ref_label_quote_the_deed_when_present()
    {
        Assert.Equal("دراسة حالة — D-1", WorkflowTaskDistributionRules.ConfirmedParentTitle("D-1", "PO-7"));
        Assert.Equal("دراسة حالة — PO-7", WorkflowTaskDistributionRules.ConfirmedParentTitle("", "PO-7"));
        Assert.Equal("D-1", WorkflowTaskDistributionRules.RefLabel(" D-1 ", "PO-7"));
        Assert.Equal("PO-7", WorkflowTaskDistributionRules.RefLabel("  ", "PO-7"));
    }

    [Fact]
    public void Assignee_id_normalizes_blank_to_null()
    {
        Assert.Null(WorkflowTaskDistributionRules.NormalizeAssigneeId("  "));
        Assert.Null(WorkflowTaskDistributionRules.NormalizeAssigneeId(null));
        Assert.Equal("fi-1", WorkflowTaskDistributionRules.NormalizeAssigneeId(" fi-1 "));
    }

    [Fact]
    public void Redistribution_detail_prefixes_the_actor_when_known()
    {
        Assert.Equal("علي: فهد — تغيير", WorkflowTaskDistributionRules.RedistributionDetail("علي", "فهد", "تغيير"));
        Assert.Equal("فهد — تغيير", WorkflowTaskDistributionRules.RedistributionDetail(" ", "فهد", "تغيير"));
    }

    // ---- timeline + notifications ----

    [Fact]
    public void Confirm_timeline_lists_distribution_study_specialist_then_each_child()
    {
        var propertyId = Guid.NewGuid();
        var parent = Parent(propertyId);
        var inspection = Child(parent, WorkflowTaskKind.FieldInspection, "fi-1");

        var events = WorkflowTaskDistributionRules.ConfirmTimelineEvents(
            parent, propertyId, [inspection], caseSpecialistAssigned: true, Now);

        Assert.Equal(
            [
                $"task:{parent.Id}:distribution",
                $"task:{parent.Id}:case-study",
                $"task:{parent.Id}:specialist-assigned",
                $"party:{inspection.Id}:assigned",
            ],
            events.Select(e => e.EventKey));
        Assert.Equal("تعيين المعاين الميداني", events[3].Title);
        Assert.All(events, e => Assert.Equal(PropertyTimelineTones.Active, e.Tone));

        var withoutSpecialist = WorkflowTaskDistributionRules.ConfirmTimelineEvents(
            parent, propertyId, [], caseSpecialistAssigned: false, Now);
        Assert.Equal(2, withoutSpecialist.Count);
    }

    [Theory]
    [InlineData(WorkflowTaskKind.EngineeringSurvey, "/active-survey/")]
    [InlineData(WorkflowTaskKind.FieldInspection, "/property-inspection/")]
    [InlineData(WorkflowTaskKind.PropertyAppraisal, "/property-appraisal/")]
    public void Task_href_routes_by_kind(WorkflowTaskKind kind, string prefix)
    {
        var id = Guid.NewGuid();
        Assert.Equal($"{prefix}{id}", WorkflowTaskDistributionRules.TaskHref(kind, id));
        Assert.Equal("/operations-tasks", WorkflowTaskDistributionRules.TaskHref(WorkflowTaskKind.CaseStudyProperty, id));
    }

    [Fact]
    public void Specialist_request_deep_links_the_case_study()
    {
        var parent = Parent();
        var request = WorkflowTaskDistributionRules.CaseSpecialistAssignedRequest(parent, "D-1");

        Assert.Equal("معاملة دراسة حالة بانتظارك", request.Title);
        Assert.Equal("أُسندت إليك دراسة حالة العقار على D-1.", request.Body);
        Assert.Equal($"/case-study/{parent.Id}", request.Href);
        Assert.Equal($"distribution-assigned-specialist:{parent.Id}", request.SourceEvent);
    }

    [Fact]
    public void Assigned_requests_deep_link_single_tasks_and_count_batches()
    {
        var parent = Parent();
        var inspection = Child(parent, WorkflowTaskKind.FieldInspection, "fi-1");
        var appraisalA = Child(parent, WorkflowTaskKind.PropertyAppraisal, "va-1");
        var surveyA = Child(parent, WorkflowTaskKind.EngineeringSurvey, "va-1");
        var unresolved = Child(parent, WorkflowTaskKind.EngineeringSurvey, "eo-9");
        var blank = Child(parent, WorkflowTaskKind.EngineeringSurvey, null);

        var requests = WorkflowTaskDistributionRules.DistributionAssignedRequests(
            parent,
            [inspection, appraisalA, surveyA, unresolved, blank],
            new Dictionary<string, string> { ["fi-1"] = "user-fi", ["va-1"] = "user-va" },
            "D-1");

        Assert.Equal(2, requests.Count);

        var single = requests["user-fi"];
        Assert.Equal("أُسندت إليك مهمة جديدة: معاينة العقار على D-1.", single.Body);
        Assert.Equal($"/property-inspection/{inspection.Id}", single.Href);
        Assert.Equal(inspection.Id.ToString(), single.EntityId);
        Assert.Equal($"distribution-assigned:{inspection.Id}", single.SourceEvent);

        var batch = requests["user-va"];
        Assert.Equal("أُسندت إليك 2 مهام جديدة على D-1.", batch.Body);
        Assert.Equal("/active-primary-data", batch.Href);
        Assert.Equal(parent.Id.ToString(), batch.EntityId);
        Assert.Equal($"distribution-assigned-batch:{parent.Id}:user-va", batch.SourceEvent);
    }
}
