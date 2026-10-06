using System.Reflection;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Batch 2C: returning the inspector's package for correction together with the decision on the affected
/// parties (sibling appraiser / engineering office) and on an issued study report — role, validation, one
/// transaction, deposited appraisal, idempotent replay, accept stamp, Enfaz freeze, notices, audit, timeline.
/// </summary>
public sealed class ReturnInspectionTests
{
    private static readonly Guid PropertyId = Guid.Parse("c1000000-0000-0000-0000-000000000001");
    private static readonly Guid ParentId = Guid.Parse("c2000000-0000-0000-0000-000000000002");
    private static readonly Guid InspectionId = Guid.Parse("c3000000-0000-0000-0000-000000000003");
    private static readonly Guid AppraisalId = Guid.Parse("c4000000-0000-0000-0000-000000000004");
    private static readonly Guid SurveyId = Guid.Parse("c5000000-0000-0000-0000-000000000005");
    private const string Po = "PO-RET";
    private const string Note = "المساحة غير مطابقة للواقع";
    private const string SiblingReason = "المعاينة أُعيدت للتصحيح — " + Note;

    private static readonly PartySubmissionActor Specialist = new()
    {
        UserId = "user-actor",
        DisplayName = "الأخصائي",
        PrototypeRole = "case-specialist",
    };

    private static ReturnInspectionRequest Request(
        string? note = Note,
        string[]? affected = null,
        string[]? sections = null,
        string? study = null) => new()
    {
        ReturnNote = note ?? "",
        AffectedTaskIds = (affected ?? []).ToList(),
        Sections = (sections ?? []).ToList(),
        StudyReport = study,
    };

    private static string[] Both => [AppraisalId.ToString(), SurveyId.ToString()];

    // -------------------------------------------------------------------- role + validation

    [Theory]
    [InlineData("real-estate-appraiser")]
    [InlineData("field-inspector")]
    [InlineData("engineering-office")]
    [InlineData(null)]
    public async Task Only_case_staff_may_return_the_inspection(string? role)
    {
        await using var rig = Arrange(appraisal: "submitted");

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId,
            Request(affected: Both),
            new PartySubmissionActor { UserId = "u", PrototypeRole = role });

        Assert.Null(result);
        Assert.Contains("صلاحية", errors!["_"]);
        Assert.Equal("submitted", await StatusOf(rig, InspectionId));
        Assert.Equal("submitted", await StatusOf(rig, AppraisalId));
        Assert.Empty(rig.Notifications.Sent);
    }

    [Fact]
    public async Task The_impact_read_is_case_staff_only_too()
    {
        await using var rig = Arrange();

        var (result, errors) = await rig.Service.GetReturnImpactAsync(
            InspectionId, ["area"], new PartySubmissionActor { UserId = "u", PrototypeRole = "real-estate-appraiser" });

        Assert.Null(result);
        Assert.Contains("صلاحية", errors!["_"]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task A_return_note_is_required(string? note)
    {
        await using var rig = Arrange();

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(note: note), Specialist);

        Assert.Null(result);
        Assert.Equal("ملاحظة الإرجاع مطلوبة", errors!["returnNote"]);
        Assert.Equal("submitted", await StatusOf(rig, InspectionId));
    }

    [Fact]
    public async Task Only_a_field_inspection_can_be_returned_this_way()
    {
        await using var rig = Arrange(appraisal: "submitted");

        var (result, errors) = await rig.Service.ReturnInspectionAsync(AppraisalId, Request(), Specialist);

        Assert.Null(result);
        Assert.Equal(PartyTaskSubmissionService.ReturnInspectionKindAr, errors!["_"]);
    }

    [Fact]
    public async Task An_unsubmitted_inspection_has_nothing_to_return()
    {
        await using var rig = Arrange(inspection: "draft");

        var (result, errors) = await rig.Service.ReturnInspectionAsync(InspectionId, Request(), Specialist);

        Assert.Null(result);
        Assert.Equal("لا يوجد إرسال مُكتمل لإعادته", errors!["_"]);
    }

    [Fact]
    public async Task Unknown_sections_and_foreign_or_malformed_affected_ids_are_refused()
    {
        await using var rig = Arrange(appraisal: "submitted");

        var badSection = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(sections: ["bogus"]), Specialist);
        var foreign = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: [Guid.NewGuid().ToString()]), Specialist);
        var malformed = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: ["not-a-guid"]), Specialist);

        Assert.Contains("bogus", badSection.Errors!["sections"]);
        Assert.Equal("طرف غير تابع لهذه المعاينة", foreign.Errors!["affectedTaskIds"]);
        Assert.Equal("معرّف طرف غير صالح", malformed.Errors!["affectedTaskIds"]);
        Assert.Equal("submitted", await StatusOf(rig, InspectionId));
    }

    [Fact]
    public async Task A_transaction_handed_over_to_enfaz_refuses_the_return()
    {
        await using var rig = Arrange(appraisal: "submitted", handedOver: true);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: Both), Specialist);

        Assert.Null(result);
        Assert.Equal("المعاملة سُلِّمت على إنفاذ — استخدم «إعادة من إنفاذ» أولاً", errors!["_"]);
        Assert.Equal("submitted", await StatusOf(rig, InspectionId));
        Assert.Equal("submitted", await StatusOf(rig, AppraisalId));
    }

    // -------------------------------------------------------------------- the return itself

    [Fact]
    public async Task The_return_reopens_the_inspector_and_a_submitted_sibling_and_only_notifies_a_draft_one()
    {
        await using var rig = Arrange(appraisal: "submitted", survey: "draft");

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: Both, sections: ["area", "boundaries"]), Specialist);

        Assert.Null(errors);
        Assert.Equal("reopened", result!.Inspection.Status);
        Assert.Equal(Note, result.Inspection.ReturnNote);
        Assert.False(result.StudyReport.Issued);
        Assert.False(result.StudyReport.Reopened);
        Assert.Equal(
            [("reopened", "property-appraisal"), ("notified", "engineering-survey")],
            result.Parties.Select(p => (p.Outcome, p.Kind)).ToArray());

        // Inspector: package reopened and the task open again.
        Assert.Equal("reopened", await StatusOf(rig, InspectionId));
        Assert.Equal(WorkflowTaskStatus.Open, await TaskStatusOf(rig, InspectionId));
        // Appraiser: package returned with the prefixed reason, task open again.
        var appraisal = await Submission(rig, AppraisalId);
        Assert.Equal("reopened", appraisal.Status);
        Assert.Equal(SiblingReason, appraisal.ReturnNote);
        Assert.Equal("reopened", JsonDocument.Parse(appraisal.PayloadJson).RootElement.GetProperty("status").GetString());
        Assert.Equal(WorkflowTaskStatus.Open, await TaskStatusOf(rig, AppraisalId));
        // Office: only a notice — the draft package and the task are untouched.
        Assert.Equal("draft", await StatusOf(rig, SurveyId));

        Assert.Contains(rig.Notifications.Sent, n => n.SourceEvent == $"field-inspection-returned:{InspectionId}");
        var reopened = Assert.Single(rig.Notifications.Sent, n =>
            n.SourceEvent == $"inspection-returned-reopened-appraiser:{AppraisalId}");
        Assert.Contains(Note, reopened.Body);
        Assert.Equal("warn", reopened.Tone);
        Assert.Contains(rig.Notifications.Sent, n => n.SourceEvent == $"inspection-returned-notified-office:{SurveyId}");
        Assert.DoesNotContain(rig.Notifications.Sent, n =>
            n.SourceEvent == $"inspection-returned-notified-appraiser:{AppraisalId}");
    }

    [Fact]
    public async Task A_submitted_engineering_office_is_reopened_with_the_existing_returned_notice()
    {
        await using var rig = Arrange(survey: "submitted");

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: [SurveyId.ToString()]), Specialist);

        Assert.Null(errors);
        Assert.Equal("reopened", Assert.Single(result!.Parties).Outcome);
        Assert.Equal("reopened", await StatusOf(rig, SurveyId));
        Assert.Equal(WorkflowTaskStatus.Open, await TaskStatusOf(rig, SurveyId));
        Assert.Contains(rig.Notifications.Sent, n => n.SourceEvent == $"engineering-survey-returned:{SurveyId}");
    }

    [Fact]
    public async Task A_draft_or_missing_package_is_only_notified()
    {
        await using var rig = Arrange(appraisal: "draft", survey: "none");

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: Both), Specialist);

        Assert.Null(errors);
        Assert.All(result!.Parties, p => Assert.Equal("notified", p.Outcome));
        Assert.Equal("draft", await StatusOf(rig, AppraisalId));
        Assert.Contains(rig.Notifications.Sent, n =>
            n.SourceEvent == $"inspection-returned-notified-appraiser:{AppraisalId}");
        Assert.Contains(rig.Notifications.Sent, n =>
            n.SourceEvent == $"inspection-returned-notified-office:{SurveyId}");
    }

    [Fact]
    public async Task A_party_the_specialist_did_not_pick_is_left_alone()
    {
        await using var rig = Arrange(appraisal: "submitted", survey: "submitted");

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: [SurveyId.ToString()]), Specialist);

        Assert.Null(errors);
        Assert.Equal(SurveyId.ToString(), Assert.Single(result!.Parties).TaskId);
        Assert.Equal("submitted", await StatusOf(rig, AppraisalId));
        Assert.Equal(WorkflowTaskStatus.Completed, await TaskStatusOf(rig, AppraisalId));
        Assert.DoesNotContain(rig.Notifications.Sent, n => n.SourceEvent!.Contains(AppraisalId.ToString()));
    }

    [Fact]
    public async Task A_party_with_no_assignee_is_skipped()
    {
        await using var rig = Arrange(survey: "submitted", surveyAssigned: false);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: [SurveyId.ToString()]), Specialist);

        Assert.Null(errors);
        Assert.Equal("skipped_no_assignee", Assert.Single(result!.Parties).Outcome);
        Assert.Equal("submitted", await StatusOf(rig, SurveyId));
    }

    [Fact]
    public async Task A_deposited_appraisal_is_never_reopened_only_notified()
    {
        await using var rig = Arrange(appraisal: "submitted", valuationOpen: false);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: [AppraisalId.ToString()]), Specialist);

        Assert.Null(errors);
        Assert.Equal("skipped_deposited", Assert.Single(result!.Parties).Outcome);
        Assert.Equal("submitted", await StatusOf(rig, AppraisalId));
        Assert.Equal(WorkflowTaskStatus.Completed, await TaskStatusOf(rig, AppraisalId));
        var notice = Assert.Single(rig.Notifications.Sent, n =>
            n.SourceEvent == $"inspection-returned-notified-appraiser:{AppraisalId}");
        Assert.Contains("مودَع", notice.Body);
        // The inspector's own return still happened.
        Assert.Equal("reopened", await StatusOf(rig, InspectionId));
    }

    [Fact]
    public async Task The_impact_marks_a_deposited_appraisal_as_notify_only_and_suggests_by_section()
    {
        await using var rig = Arrange(appraisal: "submitted", survey: "draft", valuationOpen: false);

        var (impact, errors) = await rig.Service.GetReturnImpactAsync(
            InspectionId, ["area", "boundaries"], Specialist);

        Assert.Null(errors);
        Assert.True(impact!.ValuationClosed);
        Assert.False(impact.StudyReportIssued);
        Assert.Equal(["area", "boundaries"], impact.Sections.Select(s => s.Key).ToArray());
        var appraiser = Assert.Single(impact.Parties, p => p.Kind == "property-appraisal");
        Assert.Equal("submitted", appraiser.PackageStatus);
        Assert.Equal("notify", appraiser.WillBe);
        Assert.True(appraiser.Suggested);
        Assert.Equal(["المساحات"], appraiser.SuggestedBecause);
        var office = Assert.Single(impact.Parties, p => p.Kind == "engineering-survey");
        Assert.Equal("draft", office.PackageStatus);
        Assert.Equal("notify", office.WillBe);
        Assert.Equal(["المساحات", "الحدود ومطابقة الصك"], office.SuggestedBecause);
    }

    [Fact]
    public async Task The_impact_says_reopen_for_a_submitted_open_valuation_and_unknown_task_is_null()
    {
        await using var rig = Arrange(appraisal: "submitted", valuationOpen: true);

        var (impact, _) = await rig.Service.GetReturnImpactAsync(InspectionId, ["narrative"], Specialist);
        var (missing, missingErrors) = await rig.Service.GetReturnImpactAsync(Guid.NewGuid(), [], Specialist);

        Assert.False(impact!.ValuationClosed);
        Assert.Equal("reopen", Assert.Single(impact.Parties, p => p.Kind == "property-appraisal").WillBe);
        Assert.Null(missing);
        Assert.Null(missingErrors);
    }

    [Fact]
    public async Task Returning_after_acceptance_clears_the_accept_stamp()
    {
        await using var rig = Arrange(accepted: true);
        Assert.NotNull((await Submission(rig, InspectionId)).AcceptedAtUtc);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(InspectionId, Request(), Specialist);

        Assert.Null(errors);
        Assert.Null(result!.Inspection.AcceptedAtUtc);
        var stored = await Submission(rig, InspectionId);
        Assert.Null(stored.AcceptedAtUtc);
        Assert.Null(stored.AcceptedByName);
        Assert.Equal("reopened", stored.Status);
    }

    // -------------------------------------------------------------------- idempotency

    [Fact]
    public async Task A_replay_by_the_same_user_with_the_same_note_is_idempotent()
    {
        await using var rig = Arrange(appraisal: "submitted", survey: "draft");
        var request = Request(affected: Both);
        await rig.Service.ReturnInspectionAsync(InspectionId, request, Specialist);
        var inspectionStamp = (await Submission(rig, InspectionId)).UpdatedAtUtc;
        rig.Audit.Entries.Clear();

        var (result, errors) = await rig.Service.ReturnInspectionAsync(InspectionId, request, Specialist);

        Assert.Null(errors);
        Assert.Equal("reopened", result!.Inspection.Status);
        Assert.Equal(
            [("already", "property-appraisal"), ("notified", "engineering-survey")],
            result.Parties.Select(p => (p.Outcome, p.Kind)).ToArray());
        Assert.Equal(inspectionStamp, (await Submission(rig, InspectionId)).UpdatedAtUtc);
        Assert.Empty(rig.Audit.Entries);
        Assert.Equal(1, await rig.Db.PropertyTimelineEntries.CountAsync(e =>
            e.EventKey.StartsWith($"party:{InspectionId}:returned:")));
    }

    [Fact]
    public async Task A_different_note_on_an_already_reopened_inspection_is_refused()
    {
        await using var rig = Arrange();
        await rig.Service.ReturnInspectionAsync(InspectionId, Request(), Specialist);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(note: "ملاحظة أخرى"), Specialist);

        Assert.Null(result);
        Assert.Equal("لا يوجد إرسال مُكتمل لإعادته", errors!["_"]);
    }

    // -------------------------------------------------------------------- the study report

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("maybe")]
    public async Task An_issued_study_report_forces_an_explicit_decision(string? decision)
    {
        await using var rig = Arrange(appraisal: "submitted", studyIssued: true);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: Both, study: decision), Specialist);

        Assert.Null(result);
        Assert.Equal("اختر إبقاء التقرير الصادر أو إعادة فتحه", errors!["studyReport"]);
        Assert.Equal("submitted", await StatusOf(rig, InspectionId));
        Assert.Equal("submitted", await StatusOf(rig, AppraisalId));
        Assert.Equal("issued", await ReportStatus(rig));
    }

    [Fact]
    public async Task The_impact_flags_an_issued_study_report()
    {
        await using var rig = Arrange(studyIssued: true);

        var (impact, _) = await rig.Service.GetReturnImpactAsync(InspectionId, [], Specialist);

        Assert.True(impact!.StudyReportIssued);
    }

    [Fact]
    public async Task Keeping_the_issued_report_leaves_it_issued_and_leaves_a_timeline_note_and_audit_entry()
    {
        await using var rig = Arrange(studyIssued: true);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(study: "keep", sections: ["narrative"]), Specialist);

        Assert.Null(errors);
        Assert.True(result!.StudyReport.Issued);
        Assert.False(result.StudyReport.Reopened);
        Assert.Equal("issued", await ReportStatus(rig));
        Assert.Equal(WorkflowTaskStatus.Completed, await TaskStatusOf(rig, ParentId));
        Assert.Contains(
            await rig.Db.PropertyTimelineEntries.AsNoTracking().ToListAsync(),
            e => e.EventKey.StartsWith($"case-study-report:{ParentId}:kept-after-inspection-return:")
                && e.Detail!.Contains(Note));
        var audit = Assert.Single(rig.Audit.Entries, e => e.Action == "case-study.party-submission.returned-with-impact");
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal("keep", after.RootElement.GetProperty("studyReport").GetProperty("decision").GetString());
        Assert.Equal("narrative", after.RootElement.GetProperty("sections")[0].GetString());
        Assert.Equal(Note, after.RootElement.GetProperty("returnNote").GetString());
        Assert.DoesNotContain(rig.Notifications.Sent, n => n.SourceEvent!.StartsWith("inspection-returned-study-reopened:"));
    }

    [Fact]
    public async Task Reopening_the_issued_report_reopens_the_study_and_tells_its_specialist()
    {
        await using var rig = Arrange(appraisal: "submitted", studyIssued: true);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: [AppraisalId.ToString()], study: "reopen"), Specialist);

        Assert.Null(errors);
        Assert.True(result!.StudyReport.Issued);
        Assert.True(result.StudyReport.Reopened);
        Assert.Equal("draft", await ReportStatus(rig));
        var parent = await rig.Db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == ParentId);
        Assert.Equal(WorkflowTaskStatus.Open, parent.Status);
        Assert.Equal(WorkflowTaskPhase.CaseStudy, parent.Phase);
        Assert.Equal("reopened", await StatusOf(rig, InspectionId));
        Assert.Equal("reopened", await StatusOf(rig, AppraisalId));
        Assert.Contains(
            rig.Notifications.Sent,
            n => n.SourceEvent == $"inspection-returned-study-reopened:{ParentId}");
    }

    [Fact]
    public async Task Reopening_the_study_report_is_the_case_specialists_alone_and_changes_nothing_otherwise()
    {
        await using var rig = Arrange(studyIssued: true);

        var (result, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId,
            Request(study: "reopen"),
            new PartySubmissionActor { UserId = "sup", DisplayName = "مشرف", PrototypeRole = "section-supervisor" });

        Assert.Null(result);
        Assert.Contains("صلاحية", errors!["_"]);
        Assert.Equal("submitted", await StatusOf(rig, InspectionId));
        Assert.Equal("issued", await ReportStatus(rig));
    }

    // -------------------------------------------------------------------- one transaction

    [Fact]
    public async Task Every_write_happens_inside_one_transaction_and_a_failing_sibling_surfaces_instead_of_a_partial_commit()
    {
        var spy = new TransactionSpy();
        await using var rig = Arrange(appraisal: "submitted", survey: "submitted", spy: spy);
        spy.FailPatchFor = SurveyId;

        await Assert.ThrowsAsync<InvalidOperationException>(() => rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: Both), Specialist));

        Assert.Equal(1, spy.TransactionsStarted);
        Assert.NotEmpty(spy.PatchedTasks);
        Assert.Contains(SurveyId, spy.PatchedTasks);
        // No save and no task patch ever ran outside the transaction (a real provider rolls all of it back).
        Assert.Empty(spy.WritesOutsideTransaction);
        // Inspector, appraiser and survey were all part of the same unit; no notice went out for a failed return.
        Assert.Empty(rig.Notifications.Sent);
    }

    [Fact]
    public async Task A_successful_return_uses_exactly_one_transaction()
    {
        var spy = new TransactionSpy();
        await using var rig = Arrange(appraisal: "submitted", survey: "submitted", spy: spy);

        var (_, errors) = await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: Both), Specialist);

        Assert.Null(errors);
        Assert.Equal(1, spy.TransactionsStarted);
        Assert.Equal(
            new[] { InspectionId, AppraisalId, SurveyId }.OrderBy(x => x),
            spy.PatchedTasks.OrderBy(x => x));
        Assert.Empty(spy.WritesOutsideTransaction);
    }

    // -------------------------------------------------------------------- audit + timeline

    [Fact]
    public async Task The_return_is_audited_with_sections_affected_parties_and_outcomes_and_leaves_one_timeline_row_per_party()
    {
        await using var rig = Arrange(appraisal: "submitted", survey: "draft");

        await rig.Service.ReturnInspectionAsync(
            InspectionId, Request(affected: Both, sections: ["area", "location"]), Specialist);

        var audit = Assert.Single(rig.Audit.Entries, e => e.Action == "case-study.party-submission.returned-with-impact");
        Assert.Equal(InspectionId.ToString("D"), audit.EntityId);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal(["area", "location"], after.RootElement.GetProperty("sections").EnumerateArray().Select(s => s.GetString()).ToArray());
        var affected = after.RootElement.GetProperty("affected").EnumerateArray().ToList();
        Assert.Equal(2, affected.Count);
        Assert.Equal("reopened", affected[0].GetProperty("outcome").GetString());
        Assert.Equal("notified", affected[1].GetProperty("outcome").GetString());

        var keys = (await rig.Db.PropertyTimelineEntries.AsNoTracking().ToListAsync()).Select(e => e.EventKey).ToList();
        Assert.Single(keys, k => k.StartsWith($"party:{InspectionId}:returned:"));
        Assert.Single(keys, k => k.StartsWith($"party:{AppraisalId}:inspection-returned:"));
        Assert.Single(keys, k => k.StartsWith($"party:{SurveyId}:inspection-returned:"));
    }

    // ==================================================================== plumbing

    private static async Task<string> StatusOf(Rig rig, Guid taskId) =>
        (await Submission(rig, taskId)).Status;

    private static Task<PartyTaskSubmission> Submission(Rig rig, Guid taskId) =>
        rig.Db.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == taskId);

    private static async Task<WorkflowTaskStatus> TaskStatusOf(Rig rig, Guid taskId) =>
        (await rig.Db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == taskId)).Status;

    private static async Task<string> ReportStatus(Rig rig) =>
        (await rig.Db.CaseStudyReports.AsNoTracking()
            .SingleAsync(r => r.TaskId == ParentId && !r.IsPartyContribution)).Status;

    /// <param name="inspection">submitted | draft</param>
    /// <param name="appraisal">none | draft | submitted | reopened</param>
    /// <param name="survey">none | draft | submitted | reopened</param>
    private static Rig Arrange(
        string inspection = "submitted",
        bool accepted = false,
        string appraisal = "none",
        string survey = "none",
        bool surveyAssigned = true,
        bool studyIssued = false,
        bool handedOver = false,
        bool valuationOpen = true,
        TransactionSpy? spy = null)
    {
        var contexts = TestDatabases.Create("return-inspection");
        var db = contexts.CaseStudy;
        var now = DateTime.UtcNow;

        var identity = TestInspectorFeeServiceFactory.ShareIdentity(db);
        foreach (var (userId, assigneeId, role) in new[]
                 {
                     ("user-specialist", "cs-1", "case-specialist"),
                     ("user-inspector", "fi-1", "field-inspector"),
                     ("user-appraiser", "val-1", "real-estate-appraiser"),
                     ("user-office", "eo-1", "engineering-office"),
                 })
        {
            identity.Users.Add(new ApplicationUser
            {
                Id = userId,
                UserName = userId,
                Email = $"{userId}@example.test",
                NormalizedEmail = $"{userId}@EXAMPLE.TEST",
                DisplayName = userId,
            });
            identity.UserProfiles.Add(new UserProfile
            {
                UserId = userId,
                DistributionAssigneeId = assigneeId,
                JobTitle = "party",
                RoleId = role,
                Status = UserStatus.Active,
                CreatedAtUtc = now,
            });
        }
        identity.SaveChanges();

        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = Guid.NewGuid(),
            City = "جدة",
            PropertyType = "فيلا",
            Classification = "سكني",
            DeedNumber = "1234567890",
            EnfazHandoverAtUtc = handedOver ? now : null,
            EnfazHandoverByUserId = handedOver ? "user-specialist" : null,
        });

        var inspectionSubmitted = inspection == "submitted";
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, Po, now, title: "دراسة",
                phase: WorkflowTaskPhase.CaseStudy,
                status: studyIssued ? WorkflowTaskStatus.Completed : WorkflowTaskStatus.Open,
                id: ParentId, propertyId: PropertyId, assigneeId: "cs-1"),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection, Po, now, title: "معاينة",
                phase: WorkflowTaskPhase.Done,
                status: inspectionSubmitted ? WorkflowTaskStatus.Completed : WorkflowTaskStatus.Open,
                assigneeName: "معاين", id: InspectionId, propertyId: PropertyId,
                parentTaskId: ParentId, assigneeId: "fi-1"),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal, Po, now, title: "تقييم",
                phase: WorkflowTaskPhase.Done,
                status: appraisal == "submitted" ? WorkflowTaskStatus.Completed : WorkflowTaskStatus.Open,
                assigneeName: "مقيّم", id: AppraisalId, propertyId: PropertyId,
                parentTaskId: ParentId, assigneeId: "val-1"),
            WorkflowTask.Create(
                WorkflowTaskKind.EngineeringSurvey, Po, now, title: "رفع مساحي",
                phase: WorkflowTaskPhase.Done,
                status: survey == "submitted" ? WorkflowTaskStatus.Completed : WorkflowTaskStatus.Open,
                assigneeName: "مكتب", id: SurveyId, propertyId: PropertyId,
                parentTaskId: ParentId, assigneeId: surveyAssigned ? "eo-1" : null));

        db.PartyTaskSubmissions.Add(Package(
            InspectionId, WorkflowTaskKindValues.FieldInspection,
            inspectionSubmitted ? "submitted" : "draft", accepted));
        if (appraisal != "none")
            db.PartyTaskSubmissions.Add(Package(AppraisalId, WorkflowTaskKindValues.PropertyAppraisal, appraisal));
        if (survey != "none")
            db.PartyTaskSubmissions.Add(Package(SurveyId, WorkflowTaskKindValues.EngineeringSurvey, survey));
        if (studyIssued)
        {
            db.CaseStudyReports.Add(new CaseStudyReport
            {
                Id = Guid.NewGuid(),
                TaskId = ParentId,
                IsPartyContribution = false,
                PropertyId = PropertyId,
                PoNumber = Po,
                Status = "issued",
                AnswersJson = "{}",
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }
        db.SaveChanges();

        var failures = TestInspectorFeeServiceFactory.ShareFailures(db);
        var notifications = new RecordingNotifications();
        var audit = new RecordingAuditLogAppend();
        IPartyTaskSubmissionRepository repo = new PartyTaskSubmissionRepository(db);
        IWorkflowTaskService workflow = TestInspectorFeeServiceFactory.CreateWorkflow(db);
        if (spy is not null)
        {
            repo = spy.Wrap(repo);
            workflow = spy.Wrap(workflow);
        }

        var service = new PartyTaskSubmissionService(
            repo,
            new PartyTaskFailureGate(new FailureLookup(failures)),
            workflow,
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
            new FixedRole(null),
            TestInspectorFeeServiceFactory.Create(db),
            notifications.AsService(),
            TestInspectorFeeServiceFactory.CreateRecipients(db),
            new AuditLogWriter(),
            audit,
            time: null,
            valuationRequests: ValuationStub.Create(valuationOpen),
            reports: new CaseStudyReportService(
                new CaseStudyReportRepository(db),
                TestInspectorFeeServiceFactory.CreateWorkflow(db)));
        return new Rig(contexts, service, notifications, audit);
    }

    private static PartyTaskSubmission Package(Guid taskId, string kind, string status, bool accepted = false) => new()
    {
        Id = Guid.NewGuid(),
        WorkflowTaskId = taskId,
        Kind = kind,
        Status = status,
        PropertyId = PropertyId,
        PoNumber = Po,
        PayloadJson = $$"""{"status":"{{status}}","builtArea":"300"}""",
        SubmittedAtUtc = status == "submitted" ? DateTime.UtcNow : null,
        AcceptedAtUtc = accepted ? DateTime.UtcNow : null,
        AcceptedByName = accepted ? "أخصائي" : null,
        AcceptedByUserId = accepted ? "user-specialist" : null,
        CreatedAtUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow,
    };

    private sealed class Rig(
        TestDatabases.ContextSet contexts,
        PartyTaskSubmissionService service,
        RecordingNotifications notifications,
        RecordingAuditLogAppend audit) : IAsyncDisposable
    {
        public TestDatabases.ContextSet Contexts { get; } = contexts;
        public CaseStudyDbContext Db => Contexts.CaseStudy;
        public PartyTaskSubmissionService Service { get; } = service;
        public RecordingNotifications Notifications { get; } = notifications;
        public RecordingAuditLogAppend Audit { get; } = audit;
        public ValueTask DisposeAsync() => Contexts.DisposeAsync();
    }

    private sealed class FixedRole(string? role) : ICurrentPrototypeRoleResolver
    {
        public Task<string?> ResolveAsync(CancellationToken cancellationToken) => Task.FromResult(role);
    }

    // ---- proxies (survive interface growth: every member forwards or defaults)

    /// <summary>Forwards to a real target, rewriting nothing but observing calls.</summary>
    public class ObservingProxy : DispatchProxy
    {
        public object? Target { get; set; }
        public Action<MethodInfo, object?[]>? OnCall { get; set; }
        public Func<MethodInfo, object?[], object?[]>? Rewrite { get; set; }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            args ??= [];
            OnCall?.Invoke(targetMethod!, args);
            if (Rewrite is not null) args = Rewrite(targetMethod!, args);
            try
            {
                return targetMethod!.Invoke(Target, args);
            }
            catch (TargetInvocationException ex) when (ex.InnerException is not null)
            {
                System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(ex.InnerException).Throw();
                throw;
            }
        }
    }

    /// <summary>Counts transactions and flags writes (saves / task patches) made outside of one.</summary>
    public sealed class TransactionSpy
    {
        private bool _inTransaction;
        public int TransactionsStarted { get; private set; }
        public List<string> WritesOutsideTransaction { get; } = [];
        public List<Guid> PatchedTasks { get; } = [];
        public Guid? FailPatchFor { get; set; }

        public IPartyTaskSubmissionRepository Wrap(IPartyTaskSubmissionRepository inner)
        {
            var proxy = DispatchProxy.Create<IPartyTaskSubmissionRepository, ObservingProxy>();
            var observing = (ObservingProxy)(object)proxy;
            observing.Target = inner;
            observing.OnCall = (method, _) =>
            {
                if (method.Name == nameof(IPartyTaskSubmissionRepository.SaveChangesAsync) && !_inTransaction)
                    WritesOutsideTransaction.Add("SaveChanges");
            };
            observing.Rewrite = (method, args) =>
            {
                if (method.Name != nameof(IPartyTaskSubmissionRepository.ExecuteInTransactionAsync)
                    || method.IsGenericMethod
                    || args[0] is not Func<CancellationToken, Task> action)
                    return args;

                TransactionsStarted++;
                Func<CancellationToken, Task> wrapped = async ct =>
                {
                    _inTransaction = true;
                    try
                    {
                        await action(ct);
                    }
                    finally
                    {
                        _inTransaction = false;
                    }
                };
                return [wrapped, args[1]];
            };
            return proxy;
        }

        public IWorkflowTaskService Wrap(IWorkflowTaskService inner)
        {
            var proxy = DispatchProxy.Create<IWorkflowTaskService, ObservingProxy>();
            var observing = (ObservingProxy)(object)proxy;
            observing.Target = inner;
            observing.OnCall = (method, args) =>
            {
                if (method.Name != nameof(IWorkflowTaskService.PatchAsync)) return;
                var id = (Guid)args[0]!;
                if (!_inTransaction) WritesOutsideTransaction.Add($"Patch:{id}");
                PatchedTasks.Add(id);
                if (FailPatchFor == id) throw new InvalidOperationException("simulated failure");
            };
            return proxy;
        }
    }

    /// <summary>Notification service that records requests; every other member is a harmless default.</summary>
    public sealed class RecordingNotifications
    {
        public List<CreateUserNotificationRequest> Sent { get; } = [];
        public List<string> Recipients { get; } = [];

        public INotificationService AsService()
        {
            var proxy = DispatchProxy.Create<INotificationService, DefaultingProxy>();
            ((DefaultingProxy)(object)proxy).Handler = (method, args) =>
            {
                if (method.Name == nameof(INotificationService.CreateForUserAsync))
                {
                    Recipients.Add((string)args[0]!);
                    Sent.Add((CreateUserNotificationRequest)args[1]!);
                }
                else if (method.Name == nameof(INotificationService.CreateForUsersAsync))
                {
                    Sent.Add((CreateUserNotificationRequest)args[1]!);
                    foreach (var id in (IReadOnlyCollection<string>)args[0]!) Recipients.Add(id);
                }
            };
            return proxy;
        }
    }

    public class DefaultingProxy : DispatchProxy
    {
        public Action<MethodInfo, object?[]>? Handler { get; set; }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            Handler?.Invoke(targetMethod!, args ?? []);
            return Default(targetMethod!.ReturnType);
        }

        public static object? Default(Type returnType)
        {
            if (returnType == typeof(Task)) return Task.CompletedTask;
            if (returnType.IsGenericType && returnType.GetGenericTypeDefinition() == typeof(Task<>))
            {
                var inner = returnType.GetGenericArguments()[0];
                var value = inner.IsValueType
                    ? Activator.CreateInstance(inner)
                    : inner == typeof(string) ? "" : TryNew(inner);
                return typeof(Task)
                    .GetMethod(nameof(Task.FromResult))!
                    .MakeGenericMethod(inner)
                    .Invoke(null, [value]);
            }

            return returnType.IsValueType && returnType != typeof(void) ? Activator.CreateInstance(returnType) : null;
        }

        private static object? TryNew(Type type)
        {
            try
            {
                return type.IsInterface || type.IsAbstract ? null : Activator.CreateInstance(type);
            }
            catch (MissingMethodException)
            {
                return null;
            }
        }
    }

    /// <summary>The valuation lookup: an open request exists or it does not.</summary>
    public static class ValuationStub
    {
        public static IValuationRequestService Create(bool open)
        {
            var proxy = DispatchProxy.Create<IValuationRequestService, ValuationProxy>();
            ((ValuationProxy)(object)proxy).Open = open;
            return proxy;
        }
    }

    public class ValuationProxy : DispatchProxy
    {
        public bool Open { get; set; }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod!.Name != nameof(IValuationRequestService.GetOpenByPropertyAsync))
                throw new NotSupportedException(targetMethod.Name);
            return Task.FromResult<ValuationRequestDto?>(Open
                ? new ValuationRequestDto
                {
                    DisplayId = "V-1",
                    PropId = PropertyId.ToString(),
                    Area = "100",
                    Type = "فيلا",
                    Appraiser = "مقيّم",
                    Status = "open",
                    Date = "2026-10-01",
                }
                : null);
        }
    }
}
