using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
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
/// Batch 2C: the appraiser's fingerprint of the inspector's package, the sections that moved since the
/// baseline he acknowledged (<c>inspectorDataSeen</c>, kept by the server), and the changed-data alert.
/// </summary>
public sealed class InspectorDataDigestServiceTests
{
    private static readonly Guid PropertyId = Guid.Parse("d1000000-0000-0000-0000-000000000001");
    private static readonly Guid ParentId = Guid.Parse("d2000000-0000-0000-0000-000000000002");
    private static readonly Guid InspectionId = Guid.Parse("d3000000-0000-0000-0000-000000000003");
    private static readonly Guid AppraisalId = Guid.Parse("d4000000-0000-0000-0000-000000000004");

    private static readonly PartySubmissionActor Appraiser = new()
    {
        UserId = "user-appraiser",
        DisplayName = "مقيّم",
        PrototypeRole = "real-estate-appraiser",
        DistributionAssigneeId = "val-1",
    };

    private static readonly PartySubmissionActor Inspector = new()
    {
        UserId = "user-inspector",
        DisplayName = "معاين",
        PrototypeRole = "field-inspector",
        DistributionAssigneeId = "fi-1",
    };

    private static SavePartyTaskSubmissionRequest Save(object payload) => new()
    {
        Payload = JsonSerializer.SerializeToElement(payload),
    };

    [Fact]
    public async Task The_first_read_has_a_fingerprint_and_no_changed_groups()
    {
        var rig = Arrange();

        var dto = await rig.Service.GetAsync(AppraisalId, Appraiser);

        Assert.NotNull(dto!.InspectorDataFingerprint);
        Assert.Equal(InspectorDataDigestRules.GroupKeys.Count, dto.InspectorDataFingerprint!.Split(';').Length);
        Assert.NotNull(dto.InspectorDataChangedGroups);
        Assert.Empty(dto.InspectorDataChangedGroups!);
    }

    [Fact]
    public async Task Other_kinds_carry_no_inspector_digest()
    {
        var rig = Arrange();

        var dto = await rig.Service.GetAsync(InspectionId, Inspector);

        Assert.Null(dto!.InspectorDataFingerprint);
        Assert.Null(dto.InspectorDataChangedGroups);
    }

    [Fact]
    public async Task The_baseline_the_appraiser_saves_is_kept_and_compared_on_single_and_list_reads()
    {
        var rig = Arrange();
        var seen = (await rig.Service.GetAsync(AppraisalId, Appraiser))!.InspectorDataFingerprint!;
        var (_, saveErrors) = await rig.Service.SaveDraftAsync(
            AppraisalId,
            Save(new Dictionary<string, object?> { ["status"] = "draft", ["inspectorDataSeen"] = seen, ["note"] = "x" }),
            Appraiser);
        Assert.Null(saveErrors);

        // The server never strips the baseline.
        var stored = await rig.Db.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == AppraisalId);
        Assert.Equal(seen, JsonDocument.Parse(stored.PayloadJson).RootElement.GetProperty("inspectorDataSeen").GetString());
        Assert.Empty((await rig.Service.GetAsync(AppraisalId, Appraiser))!.InspectorDataChangedGroups!);

        // The inspector changes the area and the description.
        await rig.Service.SaveDraftAsync(
            InspectionId,
            Save(new Dictionary<string, object?> { ["builtArea"] = "450", ["propertyDescription"] = "وصف جديد" }),
            Inspector);

        var single = await rig.Service.GetAsync(AppraisalId, Appraiser);
        var listed = Assert.Single(await rig.Service.ListForTasksAsync([AppraisalId], Appraiser));
        Assert.Equal(["area", "narrative"], single!.InspectorDataChangedGroups!.ToArray());
        Assert.Equal(single.InspectorDataChangedGroups, listed.InspectorDataChangedGroups);
        Assert.Equal(single.InspectorDataFingerprint, listed.InspectorDataFingerprint);
        Assert.NotEqual(seen, single.InspectorDataFingerprint);
    }

    [Fact]
    public async Task A_change_to_the_specialists_components_moves_the_components_group()
    {
        var rig = Arrange();
        var seen = (await rig.Service.GetAsync(AppraisalId, Appraiser))!.InspectorDataFingerprint!;
        await rig.Service.SaveDraftAsync(
            AppraisalId,
            Save(new Dictionary<string, object?> { ["inspectorDataSeen"] = seen }),
            Appraiser);

        rig.Db.BuildingInventoryLines.Add(new BuildingInventoryLine
        {
            Id = Guid.NewGuid(),
            PropertyId = PropertyId,
            SortOrder = 1,
            StructureKind = "floor",
            Label = "الأرضي",
            AreaSqm = "120",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await rig.Db.SaveChangesAsync();

        var dto = await rig.Service.GetAsync(AppraisalId, Appraiser);
        var listed = Assert.Single(await rig.Service.ListForTasksAsync([AppraisalId], Appraiser));

        Assert.Equal(["components"], dto!.InspectorDataChangedGroups!.ToArray());
        Assert.Equal(["components"], listed.InspectorDataChangedGroups!.ToArray());
    }

    [Fact]
    public async Task An_inspector_save_alerts_the_appraiser_who_already_acknowledged_the_data()
    {
        var rig = Arrange();
        var seen = (await rig.Service.GetAsync(AppraisalId, Appraiser))!.InspectorDataFingerprint!;
        await rig.Service.SaveDraftAsync(
            AppraisalId,
            Save(new Dictionary<string, object?> { ["inspectorDataSeen"] = seen }),
            Appraiser);

        await rig.Service.SaveDraftAsync(
            InspectionId,
            Save(new Dictionary<string, object?> { ["builtArea"] = "500" }),
            Inspector);

        var alert = Assert.Single(rig.Notifications.Sent, n =>
            n.SourceEvent == $"inspector-data-changed-appraiser:{AppraisalId}");
        Assert.Equal("تحديث في بيانات المعاينة", alert.Title);
        Assert.Contains("المساحات", alert.Body);
        Assert.Equal($"/property-appraisal/{AppraisalId}", alert.Href);
        Assert.Equal(["user-appraiser"], rig.Notifications.Recipients.Distinct().ToArray());
    }

    [Fact]
    public async Task No_baseline_or_no_real_change_means_no_alert()
    {
        var rig = Arrange();

        // No baseline yet: the first open has nothing to compare with.
        await rig.Service.SaveDraftAsync(
            InspectionId, Save(new Dictionary<string, object?> { ["builtArea"] = "500" }), Inspector);
        Assert.DoesNotContain(rig.Notifications.Sent, n => n.SourceEvent!.StartsWith("inspector-data-changed-appraiser:"));

        var seen = (await rig.Service.GetAsync(AppraisalId, Appraiser))!.InspectorDataFingerprint!;
        await rig.Service.SaveDraftAsync(
            AppraisalId, Save(new Dictionary<string, object?> { ["inspectorDataSeen"] = seen }), Appraiser);

        // Same data again, and a volatile-only change: nothing moved.
        await rig.Service.SaveDraftAsync(
            InspectionId,
            Save(new Dictionary<string, object?> { ["builtArea"] = " 500 ", ["updatedAtUtc"] = "2026-10-05T00:00:00Z" }),
            Inspector);

        Assert.DoesNotContain(rig.Notifications.Sent, n => n.SourceEvent!.StartsWith("inspector-data-changed-appraiser:"));
    }

    // -------------------------------------------------------------------- plumbing

    private sealed record Rig(
        PartyTaskSubmissionService Service,
        CaseStudyDbContext Db,
        ReturnInspectionTests.RecordingNotifications Notifications);

    private static Rig Arrange()
    {
        var bundle = TestBoundedContexts.Create($"digest-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;

        var identity = TestInspectorFeeServiceFactory.ShareIdentity(db);
        identity.Users.Add(new ApplicationUser
        {
            Id = "user-appraiser",
            UserName = "user-appraiser",
            Email = "user-appraiser@example.test",
            NormalizedEmail = "USER-APPRAISER@EXAMPLE.TEST",
            DisplayName = "user-appraiser",
        });
        identity.UserProfiles.Add(new UserProfile
        {
            UserId = "user-appraiser",
            DistributionAssigneeId = "val-1",
            JobTitle = "party",
            RoleId = "real-estate-appraiser",
            Status = UserStatus.Active,
            CreatedAtUtc = now,
        });
        identity.SaveChanges();

        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = Guid.NewGuid(),
            City = "جدة",
            PropertyType = "فيلا",
            Classification = "سكني",
            DeedNumber = "1234567890",
        });
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty, "PO-DIG", now, title: "دراسة",
                phase: WorkflowTaskPhase.CaseStudy, id: ParentId, propertyId: PropertyId, assigneeId: "cs-1"),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection, "PO-DIG", now, title: "معاينة",
                phase: WorkflowTaskPhase.Done, id: InspectionId, propertyId: PropertyId,
                parentTaskId: ParentId, assigneeId: "fi-1"),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal, "PO-DIG", now, title: "تقييم",
                phase: WorkflowTaskPhase.Done, assigneeName: "مقيّم", id: AppraisalId,
                propertyId: PropertyId, parentTaskId: ParentId, assigneeId: "val-1"));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = InspectionId,
            Kind = WorkflowTaskKindValues.FieldInspection,
            Status = PartyTaskSubmissionStatus.Draft,
            PropertyId = PropertyId,
            PoNumber = "PO-DIG",
            PayloadJson = """{"builtArea":"300","propertyDescription":"وصف"}""",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();

        var notifications = new ReturnInspectionTests.RecordingNotifications();
        var service = new PartyTaskSubmissionService(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(TestInspectorFeeServiceFactory.ShareFailures(db))),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
            new NullRole(),
            TestInspectorFeeServiceFactory.Create(db),
            notifications.AsService(),
            TestInspectorFeeServiceFactory.CreateRecipients(db),
            new AuditLogWriter(),
            new RecordingAuditLogAppend());
        return new Rig(service, db, notifications);
    }

    private sealed class NullRole : ICurrentPrototypeRoleResolver
    {
        public Task<string?> ResolveAsync(CancellationToken cancellationToken) => Task.FromResult<string?>(null);
    }
}
