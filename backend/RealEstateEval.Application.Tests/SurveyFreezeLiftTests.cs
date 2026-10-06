using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Application.Services;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Failures.Infrastructure.Persistence;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A failure freezes the engineering-survey work on its property automatically; any case
/// specialist can lift that freeze (the failure itself stays active), a failure raised after the
/// lift freezes again, and the supervisor / cdo office bypass is untouched.
/// </summary>
public sealed class SurveyFreezeLiftTests
{
    private const string Po = "PO-FRZ";
    private static readonly Guid PropertyId = Guid.Parse("f0000000-0000-0000-0000-0000000000a1");
    private static readonly Guid OtherPropertyId = Guid.Parse("f0000000-0000-0000-0000-0000000000a2");
    private static readonly Guid ParentId = Guid.Parse("f1000000-0000-0000-0000-0000000000a1");
    private static readonly Guid SurveyId = Guid.Parse("f2000000-0000-0000-0000-0000000000a1");
    private static readonly Guid ClosedSurveyId = Guid.Parse("f2000000-0000-0000-0000-0000000000a2");
    private static readonly Guid InspectionId = Guid.Parse("f3000000-0000-0000-0000-0000000000a1");

    private const string Reason = "تعذر محلول ميدانياً — يمكن متابعة الرفع";

    // ------------------------------------------------------------ the pure rules

    [Fact]
    public void The_survey_gate_blocks_on_a_freezing_failure_and_passes_once_it_is_not_freezing()
    {
        var frozen = SurveyGate(bypass: false, hasActiveFailure: true);
        Assert.Equal("الرفع المساحي مجمّد بسبب تعذر نشط على العقار.", frozen["_documentary"]);

        Assert.False(SurveyGate(bypass: false, hasActiveFailure: false).ContainsKey("_documentary"));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void The_office_bypass_ignores_the_freeze_either_way(bool freezing)
    {
        Assert.Null(DocumentaryWorkflowRules.SurveyWorkBlockReason(
            bypass: true, inspectionCompleted: false, hasActiveFailure: freezing));
        Assert.False(SurveyGate(bypass: true, hasActiveFailure: freezing).ContainsKey("_documentary"));
        Assert.True(DocumentaryWorkflowRules.RoleBypassesDocumentaryGates("cdo"));
        Assert.True(DocumentaryWorkflowRules.RoleBypassesDocumentaryGates("section-supervisor"));
        Assert.False(DocumentaryWorkflowRules.RoleBypassesDocumentaryGates("case-specialist"));
    }

    [Theory]
    [InlineData("case-specialist", true)]
    [InlineData("section-supervisor", false)]
    [InlineData("general-manager", false)]
    [InlineData("cdo", false)]
    [InlineData("real-estate-appraiser", false)]
    [InlineData("field-inspector", false)]
    [InlineData(null, false)]
    public void Only_the_case_specialist_may_lift(string? role, bool allowed)
    {
        Assert.Equal(allowed, PoRoleMatrixRules.CanLiftSurveyFreeze(role));
    }

    [Theory]
    [InlineData("", false)]
    [InlineData("قصير", false)]
    [InlineData("   عشرة   ", false)]
    [InlineData("تسعة أحرف", false)]
    [InlineData("عشرة أحرف!", true)]
    [InlineData("  سبب كافٍ وواضح  ", true)]
    public void The_reason_needs_ten_trimmed_characters(string reason, bool valid)
    {
        var errors = FailureRecordRules.ValidateLiftSurveyFreeze(Request(reason));
        Assert.Equal(valid, !errors.ContainsKey("reason"));
        Assert.DoesNotContain("poNumber", errors.Keys);
        Assert.DoesNotContain("propertyId", errors.Keys);
    }

    [Fact]
    public void A_missing_or_malformed_property_is_a_field_error()
    {
        var blank = FailureRecordRules.ValidateLiftSurveyFreeze(
            new LiftSurveyFreezeRequest { PoNumber = "", PropertyId = "", Reason = Reason });
        Assert.True(blank.ContainsKey("poNumber"));
        Assert.True(blank.ContainsKey("propertyId"));

        var malformed = FailureRecordRules.ValidateLiftSurveyFreeze(
            new LiftSurveyFreezeRequest { PoNumber = Po, PropertyId = "not-a-guid", Reason = Reason });
        Assert.Equal(["propertyId"], malformed.Keys);
    }

    // ------------------------------------------------------------ the failure entity

    [Fact]
    public void The_domain_lift_keeps_the_first_lift_and_ignores_inactive_failures()
    {
        var now = DateTime.UtcNow;
        var active = Failure(Guid.NewGuid(), PropertyFailureStatus.Review);

        Assert.True(active.LiftSurveyFreeze(" user-1 ", $"  {Reason}  ", now));
        Assert.Equal("user-1", active.SurveyFreezeLiftedByUserId);
        Assert.Equal(Reason, active.SurveyFreezeLiftReason);
        Assert.Equal(now, active.SurveyFreezeLiftedAtUtc);

        Assert.False(active.LiftSurveyFreeze("user-2", "سبب آخر مختلف تماماً", now.AddHours(1)));
        Assert.Equal("user-1", active.SurveyFreezeLiftedByUserId);
        Assert.Equal(Reason, active.SurveyFreezeLiftReason);
        Assert.Equal(now, active.SurveyFreezeLiftedAtUtc);

        foreach (var status in new[] { PropertyFailureStatus.Resolved, PropertyFailureStatus.Suspended })
        {
            var inactive = Failure(Guid.NewGuid(), status);
            Assert.False(inactive.LiftSurveyFreeze("user-1", Reason, now));
            Assert.Null(inactive.SurveyFreezeLiftedAtUtc);
        }
    }

    // ------------------------------------------------------------ the lift use case

    [Fact]
    public async Task Lifting_clears_only_the_survey_freeze_and_leaves_the_failure_active_everywhere_else()
    {
        await using var rig = Arrange();
        rig.AddFailure(PropertyFailureStatus.Approved);
        await rig.SaveFailuresAsync();

        Assert.True(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));

        var (result, errors) = await rig.Service.LiftSurveyFreezeAsync(
            Request(Reason), "specialist-1", "case-specialist");

        Assert.Null(errors);
        Assert.Equal(1, result!.Lifted);
        Assert.False(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));
        // Every other reader of "active failure" still sees it: blocking badges, the study-report gate.
        Assert.True(await rig.Lookup.HasActiveAsync(Po, PropertyId.ToString("D")));
        Assert.True(await rig.Lookup.HasBlockingAsync(Po, PropertyId.ToString("D")));
        Assert.Contains($"{Po}|{PropertyId:D}", await rig.Lookup.ListBlockingPropertyKeysAsync());
        Assert.Contains($"{Po}|{PropertyId:D}", await rig.Lookup.ListApprovedPropertyKeysAsync());
        Assert.True(await new PartyTaskFailureGate(rig.Lookup)
            .HasActiveFailureAsync(Po, PropertyId.ToString("D"), default));
        Assert.False(await new PartyTaskFailureGate(rig.Lookup)
            .HasSurveyFreezingFailureAsync(Po, PropertyId.ToString("D"), default));

        var stored = await rig.Failures.PropertyFailures.AsNoTracking().SingleAsync();
        Assert.Equal(PropertyFailureStatus.Approved, stored.Status);
        Assert.Equal("specialist-1", stored.SurveyFreezeLiftedByUserId);
        Assert.Equal(Reason, stored.SurveyFreezeLiftReason);
        Assert.NotNull(stored.SurveyFreezeLiftedAtUtc);
    }

    [Fact]
    public async Task The_lift_is_idempotent_and_counts_only_active_unlifted_failures()
    {
        await using var rig = Arrange();
        var activeA = rig.AddFailure(PropertyFailureStatus.Internal);
        var activeB = rig.AddFailure(PropertyFailureStatus.Returned);
        var resolved = rig.AddFailure(PropertyFailureStatus.Resolved);
        var suspended = rig.AddFailure(PropertyFailureStatus.Suspended);
        var elsewhere = rig.AddFailure(PropertyFailureStatus.Internal, OtherPropertyId);
        await rig.SaveFailuresAsync();

        var first = await rig.Service.LiftSurveyFreezeAsync(Request(Reason), "specialist-1", "case-specialist");
        Assert.Equal(2, first.Result!.Lifted);

        var again = await rig.Service.LiftSurveyFreezeAsync(
            Request("سبب ثانٍ لا يجب أن يحل محل الأول"), "specialist-2", "case-specialist");
        Assert.Null(again.Errors);
        Assert.Equal(0, again.Result!.Lifted);

        var rows = await rig.Failures.PropertyFailures.AsNoTracking().ToDictionaryAsync(f => f.Id);
        foreach (var id in new[] { activeA, activeB })
        {
            Assert.Equal("specialist-1", rows[id].SurveyFreezeLiftedByUserId);
            Assert.Equal(Reason, rows[id].SurveyFreezeLiftReason);
        }
        foreach (var id in new[] { resolved, suspended, elsewhere })
            Assert.Null(rows[id].SurveyFreezeLiftedAtUtc);
        Assert.True(await rig.Lookup.HasSurveyFreezingAsync(Po, OtherPropertyId.ToString("D")));

        // The repeat wrote nothing: one audit row, one timeline row, one notification round.
        Assert.Single(rig.Audit.Entries);
        Assert.Single(rig.Notifications.Sent);
    }

    [Fact]
    public async Task A_failure_raised_after_the_lift_freezes_the_survey_again()
    {
        await using var rig = Arrange();
        rig.AddFailure(PropertyFailureStatus.Internal);
        await rig.SaveFailuresAsync();
        await rig.Service.LiftSurveyFreezeAsync(Request(Reason), "specialist-1", "case-specialist");
        Assert.False(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));

        rig.AddFailure(PropertyFailureStatus.Internal);
        await rig.SaveFailuresAsync();

        Assert.True(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));

        // ... and a second lift covers just the new one.
        var second = await rig.Service.LiftSurveyFreezeAsync(Request(Reason), "specialist-1", "case-specialist");
        Assert.Equal(1, second.Result!.Lifted);
        Assert.False(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));
    }

    [Fact]
    public async Task A_resolved_only_property_has_nothing_freezing_and_nothing_to_lift()
    {
        await using var rig = Arrange();
        rig.AddFailure(PropertyFailureStatus.Resolved);
        await rig.SaveFailuresAsync();

        Assert.False(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));
        var result = await rig.Service.LiftSurveyFreezeAsync(Request(Reason), "specialist-1", "case-specialist");
        Assert.Equal(0, result.Result!.Lifted);
        Assert.Empty(rig.Audit.Entries);
    }

    [Theory]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("cdo")]
    [InlineData("real-estate-appraiser")]
    [InlineData(null)]
    public async Task Every_role_but_the_case_specialist_is_refused_and_nothing_changes(string? role)
    {
        await using var rig = Arrange();
        rig.AddFailure(PropertyFailureStatus.Internal);
        await rig.SaveFailuresAsync();

        var (result, errors) = await rig.Service.LiftSurveyFreezeAsync(Request(Reason), "user-1", role);

        Assert.Null(result);
        Assert.Equal(FailureRecordRules.LiftSurveyFreezeRoleDeniedAr, errors!["_"]);
        Assert.True(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));
        Assert.Empty(rig.Audit.Entries);
        Assert.Empty(rig.Notifications.Sent);
    }

    [Fact]
    public async Task A_short_reason_is_a_reason_field_error_and_nothing_is_lifted()
    {
        await using var rig = Arrange();
        rig.AddFailure(PropertyFailureStatus.Internal);
        await rig.SaveFailuresAsync();

        var (result, errors) = await rig.Service.LiftSurveyFreezeAsync(
            Request("   قصير  "), "specialist-1", "case-specialist");

        Assert.Null(result);
        Assert.Equal(["reason"], errors!.Keys);
        Assert.True(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));
    }

    [Fact]
    public async Task The_lift_is_audited_timelined_and_the_open_survey_assignee_is_told()
    {
        await using var rig = Arrange();
        var a = rig.AddFailure(PropertyFailureStatus.Internal);
        var b = rig.AddFailure(PropertyFailureStatus.Review);
        await rig.SaveFailuresAsync();

        await rig.Service.LiftSurveyFreezeAsync(Request($"  {Reason}  "), "specialist-1", "case-specialist");

        var audit = Assert.Single(rig.Audit.Entries);
        Assert.Equal("failures.survey-freeze.lifted", audit.Action);
        Assert.Equal("specialist-1", audit.ActorId);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal(Reason, after.RootElement.GetProperty("reason").GetString());
        Assert.Equal(Po, after.RootElement.GetProperty("poNumber").GetString());
        Assert.Equal(PropertyId.ToString("D"), after.RootElement.GetProperty("propertyId").GetString());
        var ids = after.RootElement.GetProperty("failureIds").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Equal(
            new[] { a.ToString("D"), b.ToString("D") }.OrderBy(x => x),
            ids.OrderBy(x => x));

        var timeline = await rig.CaseStudy.PropertyTimelineEntries.AsNoTracking().SingleAsync();
        Assert.Equal(PropertyId, timeline.PropertyId);
        Assert.Equal("فك تجميد الرفع المساحي", timeline.Title);
        Assert.Equal(Reason, timeline.Detail);

        // The open survey task's assignee hears about it once; the completed one is skipped.
        var sent = Assert.Single(rig.Notifications.Sent);
        Assert.Equal($"survey-freeze-lifted:{SurveyId}", sent.SourceEvent);
        Assert.Equal(["user-office"], rig.Notifications.Recipients);
        Assert.Contains(SurveyId.ToString(), sent.Href);
        Assert.Contains(Po, sent.Body);
    }

    // ------------------------------------------------------------ the survey submit, end to end

    [Fact]
    public async Task A_survey_submit_is_frozen_by_a_failure_passes_after_the_lift_and_freezes_again_on_a_new_one()
    {
        await using var rig = Arrange();
        rig.AddFailure(PropertyFailureStatus.Internal);
        await rig.SaveFailuresAsync();
        var office = new PartySubmissionActor
        {
            UserId = "user-office",
            DisplayName = "مكتب الهندسة",
            PrototypeRole = "engineering-office",
            DistributionAssigneeId = "eo-1",
        };

        var frozen = await rig.Submit.SubmitAsync(SurveyId, office);
        Assert.Null(frozen.Result);
        Assert.Equal("الرفع المساحي مجمّد بسبب تعذر نشط على العقار.", frozen.Errors!["_documentary"]);

        await rig.Service.LiftSurveyFreezeAsync(Request(Reason), "specialist-1", "case-specialist");

        // A fresh failure after the lift: frozen again, same message.
        rig.AddFailure(PropertyFailureStatus.Internal);
        await rig.SaveFailuresAsync();
        var frozenAgain = await rig.Submit.SubmitAsync(SurveyId, office);
        Assert.Equal("الرفع المساحي مجمّد بسبب تعذر نشط على العقار.", frozenAgain.Errors!["_documentary"]);

        await rig.Service.LiftSurveyFreezeAsync(Request(Reason), "specialist-1", "case-specialist");
        var submitted = await rig.Submit.SubmitAsync(SurveyId, office);
        Assert.Null(submitted.Errors);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, submitted.Result!.Status);
    }

    [Theory]
    [InlineData("section-supervisor")]
    [InlineData("cdo")]
    public async Task The_supervisor_and_cdo_submit_through_a_standing_freeze(string role)
    {
        await using var rig = Arrange(currentRole: role);
        rig.AddFailure(PropertyFailureStatus.Internal);
        await rig.SaveFailuresAsync();

        var (result, errors) = await rig.Submit.SubmitAsync(SurveyId, actor: null);

        Assert.Null(errors);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, result!.Status);
        Assert.True(await rig.Lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D")));
    }

    // ------------------------------------------------------------ the wire

    [Fact]
    public async Task The_gates_payload_carries_SurveyFrozen_and_an_old_host_falls_back_to_HasActive()
    {
        Assert.Equal(true, await RemoteSurveyFreezing(
            """{"hasActive":true,"hasBlocking":true,"surveyFrozen":true}"""));
        Assert.Equal(false, await RemoteSurveyFreezing(
            """{"hasActive":true,"hasBlocking":true,"surveyFrozen":false}"""));
        // A Failures host from before the lift sends no surveyFrozen: every active failure froze then.
        Assert.Equal(true, await RemoteSurveyFreezing("""{"hasActive":true,"hasBlocking":true}"""));
        Assert.Equal(false, await RemoteSurveyFreezing("""{"hasActive":false,"hasBlocking":false}"""));

        var json = JsonSerializer.Serialize(
            new FailurePropertyGatesDto { HasActive = true, HasBlocking = true, SurveyFrozen = false },
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Contains("\"surveyFrozen\":false", json);
    }

    [Fact]
    public async Task The_failure_record_carries_the_lift_fields_on_the_wire()
    {
        await using var rig = Arrange();
        rig.AddFailure(PropertyFailureStatus.Internal);
        await rig.SaveFailuresAsync();

        var before = Assert.Single(await rig.Lookup.ListForPropertyAsync(Po, PropertyId.ToString("D")));
        Assert.Null(before.SurveyFreezeLiftedAt);
        Assert.Null(before.SurveyFreezeLiftReason);

        await rig.Service.LiftSurveyFreezeAsync(Request(Reason), "specialist-1", "case-specialist");

        var after = Assert.Single(await rig.Lookup.ListForPropertyAsync(Po, PropertyId.ToString("D")));
        Assert.NotNull(after.SurveyFreezeLiftedAt);
        Assert.Equal(Reason, after.SurveyFreezeLiftReason);
        var viaRules = FailureRecordRules.ToDto(await rig.Failures.PropertyFailures.AsNoTracking().SingleAsync());
        Assert.Equal(after.SurveyFreezeLiftedAt, viaRules.SurveyFreezeLiftedAt);
        Assert.Equal(Reason, viaRules.SurveyFreezeLiftReason);
        var json = JsonSerializer.Serialize(after, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Contains("\"surveyFreezeLiftedAt\":", json);
        Assert.Contains("\"surveyFreezeLiftReason\":", json);
    }

    // ------------------------------------------------------------ helpers

    private static LiftSurveyFreezeRequest Request(string reason) =>
        new() { PoNumber = Po, PropertyId = PropertyId.ToString("D"), Reason = reason };

    private static PropertyFailure Failure(Guid id, string status, Guid? propertyId = null) =>
        PropertyFailure.Reconstitute(
            id,
            Po,
            propertyId ?? PropertyId,
            "صك-1",
            "تعذر",
            "access-denied",
            PropertyFailureSeverity.Internal,
            "مفتش ميداني",
            "ملاحظة",
            "",
            status,
            "specialist",
            DateTime.UtcNow,
            DateTime.UtcNow);

    private static Dictionary<string, string> SurveyGate(bool bypass, bool hasActiveFailure)
    {
        using var doc = JsonDocument.Parse("""{"siteLetterFileName":"letter.pdf","declarationPhoneSatisfied":true}""");
        return PartyTaskSubmissionRules.DocumentaryGateErrors(
            WorkflowTaskKindValues.EngineeringSurvey,
            doc.RootElement,
            bypass,
            inspectionCompleted: true,
            hasActiveFailure,
            property: null);
    }

    private static async Task<bool> RemoteSurveyFreezing(string gatesJson)
    {
        var handler = new StubHandler(gatesJson);
        var lookup = new HttpFailureLookup(
            new HttpClient(handler),
            new NullHttpContextAccessor(),
            Options.Create(new UpstreamServicesOptions { FailuresBaseUrl = "http://failures.test" }));
        var frozen = await lookup.HasSurveyFreezingAsync(Po, PropertyId.ToString("D"));
        Assert.Contains("/api/failure-dispatch/gates", handler.LastUri);
        return frozen;
    }

    private sealed class StubHandler(string json) : HttpMessageHandler
    {
        public string LastUri { get; private set; } = "";

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            LastUri = request.RequestUri!.ToString();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            });
        }
    }

    private sealed class NullHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }

    private sealed class FixedRole(string? role) : ICurrentPrototypeRoleResolver
    {
        public Task<string?> ResolveAsync(CancellationToken cancellationToken) => Task.FromResult(role);
    }

    private static Rig Arrange(string? currentRole = null)
    {
        var bundle = TestBoundedContexts.Create($"survey-freeze-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;

        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, Po, now, title: "دراسة",
                phase: WorkflowTaskPhase.CaseStudy, id: ParentId, propertyId: PropertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection, Po, now, title: "معاينة",
                phase: WorkflowTaskPhase.Done, status: WorkflowTaskStatus.Completed,
                id: InspectionId, propertyId: PropertyId, parentTaskId: ParentId,
                assigneeId: "fi-1"),
            WorkflowTask.Create(
                WorkflowTaskKind.EngineeringSurvey, Po, now, title: "رفع مساحي",
                phase: WorkflowTaskPhase.Enfath, id: SurveyId, propertyId: PropertyId,
                parentTaskId: ParentId, assigneeId: "eo-1"),
            WorkflowTask.Create(
                WorkflowTaskKind.EngineeringSurvey, Po, now, title: "رفع مساحي منجز",
                phase: WorkflowTaskPhase.Done, status: WorkflowTaskStatus.Completed,
                id: ClosedSurveyId, propertyId: PropertyId, parentTaskId: ParentId,
                assigneeId: "eo-2"));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = SurveyId,
            Kind = WorkflowTaskKindValues.EngineeringSurvey,
            Status = PartyTaskSubmissionStatus.Draft,
            PropertyId = PropertyId,
            PoNumber = Po,
            PayloadJson = JsonSerializer.Serialize(new
            {
                status = "draft",
                latitude = "24.7",
                longitude = "46.7",
                surveyReportFileName = "survey.pdf",
                siteConfirmed = true,
                siteLetterFileName = "letter.pdf",
                declarationPhoneSatisfied = true,
            }),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var identity = TestInspectorFeeServiceFactory.ShareIdentity(db);
        foreach (var (userId, assigneeId) in new[] { ("user-office", "eo-1"), ("user-office-2", "eo-2") })
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
                RoleId = "engineering-office",
                Status = UserStatus.Active,
                CreatedAtUtc = now,
            });
        }
        identity.SaveChanges();
        db.SaveChanges();

        var notifications = new RecordingNotifications();
        var audit = new RecordingAuditLogAppend();
        var service = new FailureService(
            new FailureRepository(bundle.Failures),
            new CaseStudyLookup(db),
            new CaseStudyFailureCommands(
                db,
                new WorkflowTaskShellPatcher(db),
                new PropertyTimelineService(db, new FailureLookup(bundle.Failures))),
            notifications,
            TestNotificationRecipients.ForContexts(db, identity),
            new UserLabelLookup(identity),
            new AuditLogWriter(),
            audit);

        var submit = new PartyTaskSubmissionService(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(bundle.Failures)),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
            new FixedRole(currentRole),
            TestInspectorFeeServiceFactory.Create(db),
            new RecordingNotifications(),
            TestInspectorFeeServiceFactory.CreateRecipients(db),
            new AuditLogWriter(),
            new RecordingAuditLogAppend());

        return new Rig(bundle, service, submit, new FailureLookup(bundle.Failures), notifications, audit);
    }

    private sealed class Rig(
        TestBoundedContexts.Bundle bundle,
        FailureService service,
        PartyTaskSubmissionService submit,
        FailureLookup lookup,
        RecordingNotifications notifications,
        RecordingAuditLogAppend audit) : IAsyncDisposable
    {
        public CaseStudy.Infrastructure.Data.Contexts.CaseStudyDbContext CaseStudy => bundle.CaseStudy;
        public Failures.Infrastructure.Data.Contexts.FailuresDbContext Failures => bundle.Failures;
        public FailureService Service { get; } = service;
        public PartyTaskSubmissionService Submit { get; } = submit;
        public FailureLookup Lookup { get; } = lookup;
        public RecordingNotifications Notifications { get; } = notifications;
        public RecordingAuditLogAppend Audit { get; } = audit;

        public Guid AddFailure(string status, Guid? propertyId = null)
        {
            var id = Guid.NewGuid();
            bundle.Failures.PropertyFailures.Add(Failure(id, status, propertyId));
            return id;
        }

        public Task SaveFailuresAsync() => bundle.Failures.SaveChangesAsync();

        public async ValueTask DisposeAsync()
        {
            await bundle.CaseStudy.DisposeAsync();
            await bundle.Failures.DisposeAsync();
            await bundle.Ops.DisposeAsync();
        }
    }

    private sealed class RecordingNotifications : INotificationService
    {
        public List<CreateUserNotificationRequest> Sent { get; } = [];
        public List<string> Recipients { get; } = [];

        public Task<UserNotificationDto> CreateForUserAsync(
            string userId,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default)
        {
            Sent.Add(request);
            Recipients.Add(userId);
            return Task.FromResult(new UserNotificationDto { Title = request.Title });
        }

        public Task<int> CreateForUsersAsync(
            IReadOnlyCollection<string> userIds,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default)
        {
            Sent.Add(request);
            Recipients.AddRange(userIds);
            return Task.FromResult(userIds.Count);
        }

        public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<UserNotificationDto>>([]);

        public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
            string userId,
            NotificationListQuery query,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<UserNotificationDto>>([]);

        public Task<PagedResultDto<UserNotificationDto>> ListPagedForUserAsync(
            string userId,
            NotificationListQuery query,
            int skip,
            int take,
            int page,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new PagedResultDto<UserNotificationDto>
            {
                Items = [],
                TotalCount = 0,
                Page = page,
                PageSize = take,
            });

        public Task<bool> MarkReadAsync(
            string userId,
            Guid id,
            CancellationToken cancellationToken = default) => Task.FromResult(false);

        public Task MarkAllReadAsync(string userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<bool> DeleteAsync(
            string userId,
            Guid id,
            CancellationToken cancellationToken = default) => Task.FromResult(false);

        public Task ClearForUserAsync(string userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
