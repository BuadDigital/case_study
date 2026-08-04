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
        var attachmentService = Guid.Parse("11111111-1111-1111-1111-111111111101");
        var attachmentAmenity = Guid.Parse("11111111-1111-1111-1111-111111111102");
        var attachmentPending = Guid.Parse("11111111-1111-1111-1111-111111111103");

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
              "services": ["كهرباء", "مياه"],
              "amenities": ["مساجد"],
              "observations": [
                { "id": "obs-1", "category": "عيب ظاهر", "text": "ملاحظة" }
              ],
              "definedPhotos": {
                "service:كهرباء": {
                  "none": false,
                  "photos": [
                    {
                      "id": 1,
                      "approved": true,
                      "fileName": "electricity.jpg",
                      "attachmentId": "{{attachmentService}}"
                    }
                  ]
                },
                "service:مياه": {
                  "none": false,
                  "photos": [
                    {
                      "id": 2,
                      "approved": false,
                      "fileName": "water.jpg",
                      "attachmentId": "{{attachmentPending}}"
                    }
                  ]
                },
                "amenity:مساجد": {
                  "none": true,
                  "photos": []
                }
              },
              "freePhotos": []
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
        // 2 services + 1 amenity
        Assert.Equal(3, workspace.RequiredPhotoSlots);
        // electricity approved + amenity none = 2 complete; water pending not complete
        Assert.Equal(2, workspace.CompletedPhotoSlots);
        Assert.Equal(1, workspace.PendingPhotoApprovals);
        Assert.Equal(1, workspace.ObservationCount);
        Assert.Equal(2, workspace.AttachmentCount);
    }
}
