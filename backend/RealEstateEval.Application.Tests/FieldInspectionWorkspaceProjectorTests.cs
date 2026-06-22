using System.Text.Json;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class FieldInspectionWorkspaceProjectorTests
{
    [Fact]
    public void Project_maps_payload_metrics_to_workspace_row()
    {
        var taskId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var submissionId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        var propertyId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
        var attachmentFront = Guid.Parse("11111111-1111-1111-1111-111111111101");
        var attachmentWater = Guid.Parse("11111111-1111-1111-1111-111111111102");
        var attachmentElec = Guid.Parse("11111111-1111-1111-1111-111111111103");
        var attachmentInside = Guid.Parse("11111111-1111-1111-1111-111111111104");
        var attachmentFree = Guid.Parse("11111111-1111-1111-1111-111111111105");

        var submission = new PartyTaskSubmission
        {
            Id = submissionId,
            WorkflowTaskId = taskId,
            PropertyId = propertyId,
            PoNumber = "PO-100",
            Status = PartyTaskSubmissionStatus.Submitted,
            SubmittedAtUtc = new DateTime(2026, 6, 21, 8, 0, 0, DateTimeKind.Utc),
            CreatedAtUtc = new DateTime(2026, 6, 20, 8, 0, 0, DateTimeKind.Utc),
            UpdatedAtUtc = new DateTime(2026, 6, 21, 8, 0, 0, DateTimeKind.Utc),
        };

        using var doc = JsonDocument.Parse(
            $$"""
            {
              "inspectionDate": "2026-06-21",
              "inspectionTime": "10:30",
              "mapLatitude": "21.481000",
              "mapLongitude": "39.186500",
              "inspectionConfirmed": true,
              "hasAnnex": "لا",
              "observations": [
                { "id": "obs-1", "category": "عيب ظاهر", "text": "ملاحظة" }
              ],
              "definedPhotos": {
                "front": {
                  "none": false,
                  "photos": [
                    {
                      "id": 1,
                      "approved": true,
                      "fileName": "front.jpg",
                      "attachmentId": "{{attachmentFront}}"
                    }
                  ]
                },
                "sides": { "none": true, "photos": [] },
                "water": {
                  "none": false,
                  "photos": [
                    {
                      "id": 2,
                      "approved": false,
                      "fileName": "water.jpg",
                      "attachmentId": "{{attachmentWater}}"
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
                      "attachmentId": "{{attachmentElec}}"
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
                      "attachmentId": "{{attachmentInside}}"
                    }
                  ]
                }
              },
              "freePhotos": [
                {
                  "id": 5,
                  "category": "واجهة",
                  "approved": false,
                  "fileName": "free.jpg",
                  "attachmentId": "{{attachmentFree}}"
                }
              ]
            }
            """);

        var workspace = FieldInspectionWorkspaceProjector.Project(submission, doc.RootElement);

        Assert.Equal(taskId, workspace.WorkflowTaskId);
        Assert.Equal(submissionId, workspace.PartyTaskSubmissionId);
        Assert.Equal(propertyId, workspace.PropertyId);
        Assert.Equal("PO-100", workspace.PoNumber);
        Assert.Equal(new DateOnly(2026, 6, 21), workspace.InspectionDate);
        Assert.Equal("10:30", workspace.InspectionTime);
        Assert.Equal(21.481000m, workspace.MapLatitude);
        Assert.Equal(39.186500m, workspace.MapLongitude);
        Assert.True(workspace.InspectionConfirmed);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, workspace.Status);
        Assert.Equal(5, workspace.RequiredPhotoSlots);
        Assert.Equal(4, workspace.CompletedPhotoSlots);
        Assert.Equal(2, workspace.PendingPhotoApprovals);
        Assert.Equal(1, workspace.ObservationCount);
        Assert.Equal(5, workspace.AttachmentCount);
        Assert.Equal(submission.SubmittedAtUtc, workspace.SubmittedAtUtc);
    }
}
