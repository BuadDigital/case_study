using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FieldInspectionSubmissionIntegrationTests
{
    private static readonly Guid TaskId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid PropertyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid ServicePhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
    private static readonly Guid AmenityPhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");

    [Fact]
    public async Task SaveDraft_syncs_field_inspection_workspace_row()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var service = CreateService(db, bundle.Failures, bundle.Ops);
        SeedInspectionTask(db);
        SeedPhotoAttachments(db);

        var payload = ParsePayload(MinimalValidPayload());
        var (result, errors) = await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload });

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.Equal("draft", result!.Status);

        var workspace = await db.FieldInspectionWorkspaces
            .AsNoTracking()
            .SingleAsync(w => w.WorkflowTaskId == TaskId);

        Assert.Equal(PartyTaskSubmissionStatus.Draft, workspace.Status);
        Assert.Equal(2, workspace.AttachmentCount);
        Assert.Equal(2, workspace.RequiredPhotoSlots);
    }

    [Fact]
    public async Task Submit_syncs_workspace_completes_task_and_marks_submission_submitted()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var service = CreateService(db, bundle.Failures, bundle.Ops);
        SeedInspectionTask(db);
        SeedPhotoAttachments(db);

        var payload = ParsePayload(MinimalValidPayload());
        await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload });

        var (result, errors) = await service.SubmitAsync(TaskId);

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.Equal("submitted", result!.Status);
        Assert.False(string.IsNullOrWhiteSpace(result.SubmittedAtUtc));

        var workspace = await db.FieldInspectionWorkspaces
            .AsNoTracking()
            .SingleAsync(w => w.WorkflowTaskId == TaskId);

        Assert.Equal(PartyTaskSubmissionStatus.Submitted, workspace.Status);
        Assert.NotNull(workspace.SubmittedAtUtc);
        Assert.Equal(21.481000m, workspace.MapLatitude);
        Assert.Equal(39.186500m, workspace.MapLongitude);
        Assert.True(workspace.InspectionConfirmed);

        var task = await db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == TaskId);
        Assert.Equal(WorkflowTaskStatus.Completed, task.Status);
        Assert.Equal(WorkflowTaskPhase.Done, task.Phase);
    }

    [Fact]
    public async Task Submit_rejects_when_attachment_rows_are_missing()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var service = CreateService(db, bundle.Failures, bundle.Ops);
        SeedInspectionTask(db);

        var payload = ParsePayload(MinimalValidPayload());
        await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload });

        var (result, errors) = await service.SubmitAsync(TaskId);

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("definedPhotos", errors!.Keys);

        var workspaceCount = await db.FieldInspectionWorkspaces.CountAsync();
        Assert.Equal(1, workspaceCount);

        var task = await db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == TaskId);
        Assert.Equal(WorkflowTaskStatus.Open, task.Status);
    }

    [Fact]
    public async Task Reopen_submitted_inspection_reopens_task_and_workspace()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var service = CreateService(db, bundle.Failures, bundle.Ops);
        SeedInspectionTask(db);
        SeedPhotoAttachments(db);

        var payload = ParsePayload(MinimalValidPayload());
        await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload });
        await service.SubmitAsync(TaskId);

        var (reopened, errors) = await service.ReopenAsync(
            TaskId,
            new ReopenPartyTaskSubmissionRequest { ReturnNote = "صور الواجهة غير واضحة" });

        Assert.Null(errors);
        Assert.NotNull(reopened);
        Assert.Equal(PartyTaskSubmissionStatus.Reopened, reopened!.Status);

        var workspace = await db.FieldInspectionWorkspaces
            .AsNoTracking()
            .SingleAsync(w => w.WorkflowTaskId == TaskId);
        Assert.Equal(PartyTaskSubmissionStatus.Reopened, workspace.Status);

        var task = await db.WorkflowTasks.AsNoTracking().SingleAsync(t => t.Id == TaskId);
        Assert.Equal(WorkflowTaskStatus.Open, task.Status);
    }

    [Fact]
    public async Task Reopen_requires_return_note_for_field_inspection()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var service = CreateService(db, bundle.Failures, bundle.Ops);
        SeedInspectionTask(db);
        SeedPhotoAttachments(db);

        var payload = ParsePayload(MinimalValidPayload());
        await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload });
        await service.SubmitAsync(TaskId);

        var (_, errors) = await service.ReopenAsync(
            TaskId,
            new ReopenPartyTaskSubmissionRequest { ReturnNote = "  " });

        Assert.NotNull(errors);
        Assert.True(errors!.ContainsKey("returnNote"));
    }

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"field-inspection-{Guid.NewGuid():N}");

    private static PartyTaskSubmissionService CreateService(ApplicationDbContext db, FailuresDbContext failures, OperationsDbContext __)
    {
        var caseStudy = TestInspectorFeeServiceFactory.ShareCaseStudy(db);
        var timeline = TestInspectorFeeServiceFactory.CreateTimeline(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        return new(
            caseStudy,
            failures,
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            timeline,
            new NullHttpContextAccessor(),
            new NullPermissionService(),
            TestInspectorFeeServiceFactory.Create(db),
            notifications,
            recipients);
    }

    private sealed class NullHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }

    private sealed class NullPermissionService : IPermissionService
    {
        public Task<PermissionsDto?> GetForUserIdAsync(string userId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult<PermissionsDto?>(null);
        }
    }

    private static void SeedInspectionTask(ApplicationDbContext db)
    {
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-100",
            DateTime.UtcNow,
            title: "معاينة العقار",
            phase: WorkflowTaskPhase.Done,
            id: TaskId,
            propertyId: PropertyId));
        db.SaveChanges();
    }

    private static void SeedPhotoAttachments(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        var rows = new (Guid Id, string PhotoRef)[]
        {
            (ServicePhotoAttachmentId, "slot:service:كهرباء:1"),
            (AmenityPhotoAttachmentId, "slot:amenity:مساجد:2"),
        };

        foreach (var (id, photoRef) in rows)
        {
            db.FileAttachments.Add(new FileAttachment
            {
                Id = id,
                Scope = FieldInspectionScopes.Photo,
                ScopeKey = $"{TaskId}:{photoRef}",
                FileName = $"{photoRef}.jpg",
                ContentType = "image/jpeg",
                SizeBytes = 1024,
                UploadedByUserId = "test-user",
                CreatedAtUtc = now,
            });
        }

        db.SaveChanges();
    }

    private static JsonElement ParsePayload(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    private static string MinimalValidPayload() =>
        $$"""
        {
          "status": "draft",
          "inspectionDate": "2026-06-21",
          "inspectionTime": "10:30",
          "mapLatitude": "21.481000",
          "mapLongitude": "39.186500",
          "inspectionConfirmed": true,
          "keyAvailable": true,
          "hasAnnex": "لا",
          "showroomCount": "",
          "wellCount": "",
          "featureValues": {},
          "featurePhotoAttachments": {},
          "componentPhotoAttachments": { "showroom": null, "well": null },
          "observations": [],
          "freePhotos": [],
          "services": ["كهرباء"],
          "amenities": ["مساجد"],
          "definedPhotos": {
            "service:كهرباء": {
              "none": false,
              "photos": [
                {
                  "id": 1,
                  "approved": true,
                  "fileName": "electricity.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{ServicePhotoAttachmentId}}"
                }
              ]
            },
            "amenity:مساجد": {
              "none": false,
              "photos": [
                {
                  "id": 2,
                  "approved": true,
                  "fileName": "mosque.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{AmenityPhotoAttachmentId}}"
                }
              ]
            }
          }
        }
        """;
}
