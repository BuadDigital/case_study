using System.Text.Json;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class PartyTaskSubmissionRulesTests
{
    private static readonly DateTime Now = new(2026, 9, 6, 9, 0, 0, DateTimeKind.Utc);

    private static WorkflowTask MakeTask(
        WorkflowTaskKind kind = WorkflowTaskKind.FieldInspection,
        string? assigneeId = "fi-1",
        string assigneeName = "المعاين") =>
        WorkflowTask.Create(kind, "PO-3", Now, assigneeName: assigneeName, assigneeId: assigneeId, propertyId: Guid.NewGuid());

    private static PartySubmissionActor Actor(string role, string userId = "u-1", string? distributionId = null) =>
        new() { UserId = userId, DisplayName = "الاسم", PrototypeRole = role, DistributionAssigneeId = distributionId };

    private static JsonElement Root(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static WorkOrderProperty Property(bool withPhone, string? plan = null, string? plot = null)
    {
        var property = new WorkOrderProperty { Id = Guid.NewGuid(), PlanNumber = plan, PlotNumber = plot };
        if (withPhone)
            property.Contacts.Add(new PropertyContact { Id = Guid.NewGuid(), Name = "المالك", Phone = "0501234567" });
        return property;
    }

    // ---- kinds + write rights ----

    [Fact]
    public void Only_party_kinds_submit_through_the_service()
    {
        Assert.True(PartyTaskSubmissionRules.IsPartySubmissionKind(WorkflowTaskKind.EngineeringSurvey));
        Assert.True(PartyTaskSubmissionRules.IsPartySubmissionKind(WorkflowTaskKind.FieldInspection));
        Assert.True(PartyTaskSubmissionRules.IsPartySubmissionKind(WorkflowTaskKind.PropertyAppraisal));
        Assert.False(PartyTaskSubmissionRules.IsPartySubmissionKind(WorkflowTaskKind.CaseStudyProperty));
    }

    [Fact]
    public void Staff_may_correct_a_field_inspection_only()
    {
        Assert.True(PartyTaskSubmissionRules.StaffMayCorrectFieldInspection(Actor("case-specialist"), MakeTask()));
        Assert.False(PartyTaskSubmissionRules.StaffMayCorrectFieldInspection(
            Actor("case-specialist"), MakeTask(WorkflowTaskKind.EngineeringSurvey)));
        Assert.False(PartyTaskSubmissionRules.StaffMayCorrectFieldInspection(Actor("field-inspector"), MakeTask()));
        Assert.False(PartyTaskSubmissionRules.StaffMayCorrectFieldInspection(null, MakeTask()));
    }

    [Fact]
    public void Draft_write_is_for_the_assignee_anonymous_callers_or_correcting_staff()
    {
        var task = MakeTask(assigneeId: "fi-1");

        Assert.True(PartyTaskSubmissionRules.MayWriteDraft(null, task, staffMayCorrect: false));
        Assert.True(PartyTaskSubmissionRules.MayWriteDraft(Actor("field-inspector", "fi-1"), task, false));
        Assert.True(PartyTaskSubmissionRules.MayWriteDraft(
            Actor("field-inspector", "other", distributionId: "fi-1"), task, false));
        Assert.False(PartyTaskSubmissionRules.MayWriteDraft(Actor("field-inspector", "other"), task, false));
        Assert.True(PartyTaskSubmissionRules.MayWriteDraft(Actor("case-specialist", "other"), task, true));
    }

    // ---- labels ----

    [Fact]
    public void Accept_actor_user_id_defaults_to_system()
    {
        Assert.Equal("system", PartyTaskSubmissionRules.AcceptActorUserId(Actor("cdo", userId: " ")));
        Assert.Equal("u-1", PartyTaskSubmissionRules.AcceptActorUserId(Actor("cdo")));
    }

    [Theory]
    [InlineData(WorkflowTaskKind.FieldInspection, "استلام بيانات المعاينة")]
    [InlineData(WorkflowTaskKind.PropertyAppraisal, "اعتماد تقرير التقييم")]
    [InlineData(WorkflowTaskKind.EngineeringSurvey, "قبول مخرجات الرفع المساحي")]
    public void Accepted_timeline_title_follows_the_kind(WorkflowTaskKind kind, string expected)
    {
        Assert.Equal(expected, PartyTaskSubmissionRules.AcceptedTimelineTitle(kind));
    }

    [Fact]
    public void Submitted_actor_label_prefers_the_submitter_then_the_assignee()
    {
        var task = MakeTask(assigneeName: "المعاين");
        Assert.Equal("علي", PartyTaskSubmissionRules.SubmittedActorLabel(
            new PartyTaskSubmission { SubmittedByName = "علي" }, task));
        Assert.Equal("المعاين", PartyTaskSubmissionRules.SubmittedActorLabel(new PartyTaskSubmission(), task));
        Assert.Null(PartyTaskSubmissionRules.SubmittedActorLabel(
            new PartyTaskSubmission(), MakeTask(assigneeName: " ")));
    }

    // ---- documentary gates ----

    [Fact]
    public void Survey_gate_blocks_before_the_inspection_completes_and_wants_a_site_letter()
    {
        var errors = PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.EngineeringSurvey,
            Root("{}"),
            bypass: false,
            inspectionCompleted: false,
            hasActiveFailure: false,
            Property(withPhone: true));

        Assert.Equal("لا يمكن بدء الرفع المساحي قبل اكتمال المعاينة الميدانية.", errors["_documentary"]);
        Assert.Equal("خطاب الموقع مطلوب", errors["siteLetterFileName"]);
    }

    [Fact]
    public void Survey_gate_wants_a_party_phone_once_the_site_is_confirmed()
    {
        var errors = PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.EngineeringSurvey,
            Root("""{"siteConfirmed":true}"""),
            bypass: false,
            inspectionCompleted: true,
            hasActiveFailure: false,
            Property(withPhone: false, plan: "P1", plot: "12"));

        Assert.Equal(
            "لا يمكن توقيع إقرار العميل بدون وسيلة اتصال (جوال) لأحد الأطراف.",
            errors["siteLetterFileName"]);
        Assert.False(errors.ContainsKey("_documentary"));
    }

    [Fact]
    public void Survey_gate_is_clear_for_a_platted_property_with_a_phone_and_no_failure()
    {
        var errors = PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.EngineeringSurvey,
            Root("""{"siteConfirmed":true}"""),
            bypass: false,
            inspectionCompleted: true,
            hasActiveFailure: false,
            Property(withPhone: true, plan: "P1", plot: "12"));

        Assert.Empty(errors);
    }

    [Fact]
    public void Bypass_clears_the_survey_and_phone_blocks_but_not_the_site_letter()
    {
        var errors = PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.EngineeringSurvey,
            Root("""{"siteConfirmed":true}"""),
            bypass: true,
            inspectionCompleted: false,
            hasActiveFailure: true,
            Property(withPhone: false));

        Assert.Equal("siteLetterFileName", Assert.Single(errors.Keys));
        Assert.Equal("خطاب الموقع مطلوب", errors["siteLetterFileName"]);
    }

    [Fact]
    public void Inspection_gate_blocks_a_signed_declaration_without_a_phone()
    {
        var signed = PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.FieldInspection,
            Root("""{"clientDeclarationSigned":true}"""),
            bypass: false,
            inspectionCompleted: false,
            hasActiveFailure: true,
            null);
        Assert.Equal("clientDeclarationSigned", Assert.Single(signed.Keys));

        var satisfiedEarlier = PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.FieldInspection,
            Root("""{"clientDeclarationSigned":true,"declarationPhoneSatisfied":true}"""),
            bypass: false,
            inspectionCompleted: false,
            hasActiveFailure: false,
            null);
        Assert.Empty(satisfiedEarlier);

        var unsigned = PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.FieldInspection, Root("{}"), false, false, false, null);
        Assert.Empty(unsigned);
    }

    [Fact]
    public void Appraisal_has_no_documentary_gate()
    {
        var errors = PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.PropertyAppraisal, Root("{}"), false, false, true, null);

        Assert.Empty(errors);
    }

    // ---- projection ----

    [Fact]
    public void Unsaved_draft_mirrors_the_task_with_an_empty_payload()
    {
        var task = MakeTask(WorkflowTaskKind.EngineeringSurvey);
        var draft = PartyTaskSubmissionRules.UnsavedDraft(task);

        Assert.Equal(Guid.Empty, draft.Id);
        Assert.Equal(task.Id, draft.WorkflowTaskId);
        Assert.Equal(WorkflowTaskKindValues.EngineeringSurvey, draft.Kind);
        Assert.Equal(PartyTaskSubmissionStatus.Draft, draft.Status);
        Assert.Equal(task.PropertyId, draft.PropertyId);
        Assert.Equal("PO-3", draft.PoNumber);
        Assert.Equal("{}", draft.PayloadJson);
    }

    [Fact]
    public void Dto_projects_timestamps_as_round_trip_strings_and_tolerates_bad_payload()
    {
        var entity = new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = Guid.NewGuid(),
            Kind = WorkflowTaskKindValues.FieldInspection,
            Status = PartyTaskSubmissionStatus.Submitted,
            PoNumber = "PO-3",
            PayloadJson = """{"visitStatus":"done"}""",
            SubmittedAtUtc = Now,
            UpdatedAtUtc = Now,
            SubmittedByName = "علي",
        };

        var dto = PartyTaskSubmissionRules.ToDto(entity);

        Assert.Equal(entity.Id.ToString(), dto.Id);
        Assert.Equal(entity.WorkflowTaskId.ToString(), dto.TaskId);
        Assert.Equal(Now.ToString("O"), dto.SubmittedAtUtc);
        Assert.Null(dto.AcceptedAtUtc);
        Assert.Null(dto.PropertyId);
        Assert.Equal("done", dto.Payload.GetProperty("visitStatus").GetString());

        entity.PayloadJson = "not json";
        Assert.Equal(JsonValueKind.Object, PartyTaskSubmissionRules.ToDto(entity).Payload.ValueKind);
    }
}
