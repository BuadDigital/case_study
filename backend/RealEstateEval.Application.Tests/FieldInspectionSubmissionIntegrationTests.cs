using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FieldInspectionSubmissionIntegrationTests
{
    private static readonly Guid TaskId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid PropertyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid FrontPhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
    private static readonly Guid WaterPhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
    private static readonly Guid ElecPhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3");
    private static readonly Guid InsidePhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4");

    [Fact]
    public async Task SaveDraft_syncs_field_inspection_workspace_row()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
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
        Assert.Equal(4, workspace.AttachmentCount);
        Assert.Equal(5, workspace.RequiredPhotoSlots);
    }

    [Fact]
    public async Task Submit_syncs_workspace_completes_task_and_marks_submission_submitted()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
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
        Assert.Equal("done", task.Phase);
    }

    [Fact]
    public async Task Submit_rejects_when_attachment_rows_are_missing()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
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
        await using var db = CreateDb();
        var service = CreateService(db);
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
        await using var db = CreateDb();
        var service = CreateService(db);
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

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"field-inspection-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static PartyTaskSubmissionService CreateService(ApplicationDbContext db)
    {
        var fees = new InspectorFeeService(db);
        return new(db, new WorkflowTaskService(db, fees), new FieldInspectionAttachmentVerifier(db));
    }

    private static void SeedInspectionTask(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(new WorkflowTask
        {
            Id = TaskId,
            Kind = "field-inspection",
            PoNumber = "PO-100",
            PropertyId = PropertyId,
            PropertyOrdinal = 1,
            Title = "معاينة العقار",
            Phase = "bourse",
            Status = WorkflowTaskStatus.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
    }

    private static void SeedPhotoAttachments(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        var rows = new (Guid Id, string PhotoRef)[]
        {
            (FrontPhotoAttachmentId, "slot:front:1"),
            (WaterPhotoAttachmentId, "slot:water:2"),
            (ElecPhotoAttachmentId, "slot:elec:3"),
            (InsidePhotoAttachmentId, "slot:inside:4"),
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
          "hasAnnex": "لا",
          "showroomCount": "",
          "wellCount": "",
          "featureValues": {},
          "featurePhotoAttachments": {},
          "componentPhotoAttachments": { "showroom": null, "well": null },
          "observations": [],
          "freePhotos": [],
          "definedPhotos": {
            "front": {
              "none": false,
              "photos": [
                {
                  "id": 1,
                  "approved": true,
                  "fileName": "front.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{FrontPhotoAttachmentId}}"
                }
              ]
            },
            "sides": { "none": true, "photos": [] },
            "water": {
              "none": false,
              "photos": [
                {
                  "id": 2,
                  "approved": true,
                  "fileName": "water.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{WaterPhotoAttachmentId}}"
                }
              ]
            },
            "elec": {
              "none": false,
              "photos": [
                {
                  "id": 3,
                  "approved": true,
                  "fileName": "elec.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{ElecPhotoAttachmentId}}"
                }
              ]
            },
            "inside": {
              "none": false,
              "photos": [
                {
                  "id": 4,
                  "approved": true,
                  "fileName": "inside.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{InsidePhotoAttachmentId}}"
                }
              ]
            },
            "floor": { "none": false, "photos": [] },
            "annexup": { "none": false, "photos": [] },
            "annexdn": { "none": false, "photos": [] }
          }
        }
        """;
}
