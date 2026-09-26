using System.Text.Json;
using Microsoft.AspNetCore.Http;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// security_offline_spec §4.4 — one owning source per field. The inspector's package never
/// carries the specialist's source data, so the server wins on it; when that data changed
/// after the inspector downloaded the task (typically while working offline), the case
/// specialist is alerted to review the answers.
/// </summary>
public sealed class InspectionSourceChangeAlertTests
{
    private static readonly Guid InspectionTaskId = Guid.Parse("61111111-1111-1111-1111-111111111111");
    private static readonly Guid ParentTaskId = Guid.Parse("64444444-4444-4444-4444-444444444444");
    private static readonly Guid PropertyId = Guid.Parse("65555555-5555-5555-5555-555555555555");

    private static readonly PartySubmissionActor Inspector = new()
    {
        UserId = "user-inspector",
        DisplayName = "معاين",
        PrototypeRole = "field-inspector",
        DistributionAssigneeId = "fi-1",
    };

    [Fact]
    public void Fingerprint_follows_the_source_fields_only()
    {
        var property = SourceProperty();
        var before = InspectionSourceDataRules.Fingerprint(property);

        property.District = "حي آخر";
        property.Area = "900";
        Assert.Equal(before, InspectionSourceDataRules.Fingerprint(property));

        property.DeedOwnersJson = """[ { "sharePct": 100, "name": "مالك أول" } ]""";
        Assert.Equal(before, InspectionSourceDataRules.Fingerprint(property));

        property.DeedNumber = "999999999999";
        Assert.NotEqual(before, InspectionSourceDataRules.Fingerprint(property));
    }

    [Fact]
    public async Task A_save_based_on_an_older_download_alerts_the_specialist()
    {
        var (service, notifications, db) = Arrange();
        var downloaded = InspectionSourceDataRules.Fingerprint(SourceProperty());

        // The specialist corrects the deed while the inspector works offline.
        var property = db.WorkOrderProperties.Single(p => p.Id == PropertyId);
        property.Court = "المحكمة العامة بمكة";
        await db.SaveChangesAsync();

        var (result, errors) = await service.SaveDraftAsync(
            InspectionTaskId,
            SaveRequest(downloaded),
            Inspector);

        Assert.Null(errors);
        var alert = Assert.Single(
            notifications.Sent,
            n => n.SourceEvent == $"inspection-source-changed:{InspectionTaskId}");
        Assert.Equal("تغيّرت بيانات مصدرية بعد تنزيل المعاين", alert.Title);
        Assert.Contains("راجع الإجابات", alert.Body);
        Assert.Contains(ParentTaskId.ToString(), alert.Href);
        Assert.Equal(new[] { "user-specialist" }, notifications.Recipients);

        // The server's current values stand — the reply hands the device the new fingerprint.
        Assert.Equal(InspectionSourceDataRules.Fingerprint(property), result!.SourceFingerprint);
    }

    [Fact]
    public async Task A_save_on_current_source_data_stays_quiet_and_the_marker_is_not_stored()
    {
        var (service, notifications, db) = Arrange();
        var current = InspectionSourceDataRules.Fingerprint(SourceProperty());

        var (result, errors) = await service.SaveDraftAsync(
            InspectionTaskId,
            SaveRequest(current),
            Inspector);

        Assert.Null(errors);
        Assert.DoesNotContain(
            notifications.Sent,
            n => n.SourceEvent?.StartsWith("inspection-source-changed:") == true);
        var stored = db.PartyTaskSubmissions.Single(s => s.WorkflowTaskId == InspectionTaskId);
        using var storedPayload = JsonDocument.Parse(stored.PayloadJson);
        Assert.False(storedPayload.RootElement.TryGetProperty(
            InspectionSourceDataRules.SeenPayloadKey, out _));
        Assert.Equal("ملاحظة", storedPayload.RootElement.GetProperty("assetNotes").GetString());
        Assert.Equal(current, result!.SourceFingerprint);
    }

    [Fact]
    public async Task A_save_without_a_fingerprint_never_alerts()
    {
        var (service, notifications, db) = Arrange();
        var property = db.WorkOrderProperties.Single(p => p.Id == PropertyId);
        property.DeedNumber = "111";
        await db.SaveChangesAsync();

        await service.SaveDraftAsync(InspectionTaskId, SaveRequest(null), Inspector);

        Assert.DoesNotContain(
            notifications.Sent,
            n => n.SourceEvent?.StartsWith("inspection-source-changed:") == true);
    }

    private static SavePartyTaskSubmissionRequest SaveRequest(string? fingerprintSeen)
    {
        var payload = new Dictionary<string, object?> { ["assetNotes"] = "ملاحظة" };
        if (fingerprintSeen is not null)
            payload[InspectionSourceDataRules.SeenPayloadKey] = fingerprintSeen;
        return new SavePartyTaskSubmissionRequest
        {
            Payload = JsonSerializer.SerializeToElement(payload),
        };
    }

    private static WorkOrderProperty SourceProperty() => new()
    {
        Id = PropertyId,
        WorkOrderId = Guid.NewGuid(),
        DeedNumber = "715702003577",
        DeedDate = "2020-01-01",
        RequestNumber = "REQ-1",
        AssignmentMandateNumber = "AM-9",
        AssignmentMandateDate = "2026-09-01",
        OwnerName = "مالك أول",
        DeedOwnersJson = """[{"name":"مالك أول","sharePct":100}]""",
        Court = "المحكمة العامة بجدة",
        Circuit = "3",
        City = "جدة",
        District = "الروضة",
    };

    private static (PartyTaskSubmissionService Service, RecordingNotifications Notifications, CaseStudyDbContext Db) Arrange()
    {
        var bundle = TestBoundedContexts.Create($"source-change-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;

        var identity = TestInspectorFeeServiceFactory.ShareIdentity(db);
        foreach (var (userId, assigneeId, role) in new[]
                 {
                     ("user-inspector", "fi-1", "field-inspector"),
                     ("user-specialist", "cs-1", "case-specialist"),
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

        db.WorkOrderProperties.Add(SourceProperty());
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-600",
            now,
            title: "دراسة الحالة",
            id: ParentTaskId,
            propertyId: PropertyId,
            assigneeId: "cs-1"));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-600",
            now,
            title: "المعاينة الميدانية",
            id: InspectionTaskId,
            propertyId: PropertyId,
            assigneeId: "fi-1",
            parentTaskId: ParentTaskId));
        db.SaveChanges();

        var notifications = new RecordingNotifications();
        return (CreateService(db, bundle.Failures, notifications), notifications, db);
    }

    private static PartyTaskSubmissionService CreateService(
        CaseStudyDbContext db,
        FailuresDbContext failures,
        INotificationService notifications) =>
        new(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(failures)),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(
                TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
            new HttpCurrentPrototypeRoleResolver(new NullHttpContextAccessor(), new NullPermissions()),
            TestInspectorFeeServiceFactory.Create(db),
            notifications,
            TestInspectorFeeServiceFactory.CreateRecipients(db),
            new AuditLogWriter(),
            new RecordingAuditLogAppend());

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

    private sealed class NullHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }

    private sealed class NullPermissions : IPermissionService
    {
        public Task<PermissionsDto?> GetForUserIdAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<PermissionsDto?>(null);
    }
}
