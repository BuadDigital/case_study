using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FieldInspectionAttachmentVerifierTests
{
    [Fact]
    public async Task VerifyAsync_accepts_matching_scope_and_scope_key()
    {
        var taskId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var attachmentId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

        await using var db = CreateDb();
        db.FileAttachments.Add(new FileAttachment
        {
            Id = attachmentId,
            Scope = FieldInspectionScopes.Photo,
            ScopeKey = $"{taskId}:slot:front:1",
            FileName = "front.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 512,
            UploadedByUserId = "test-user",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        using var payload = JsonDocument.Parse(
            $$"""
            {
              "definedPhotos": {
                "front": {
                  "photos": [
                    {
                      "id": 1,
                      "fileName": "front.jpg",
                      "attachmentId": "{{attachmentId}}"
                    }
                  ]
                }
              }
            }
            """);

        var verifier = new FieldInspectionAttachmentVerifier(db);
        var errors = await verifier.VerifyAsync(taskId, payload.RootElement);

        Assert.Empty(errors);
    }

    [Fact]
    public async Task VerifyAsync_rejects_wrong_scope_key()
    {
        var taskId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var attachmentId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

        await using var db = CreateDb();
        db.FileAttachments.Add(new FileAttachment
        {
            Id = attachmentId,
            Scope = FieldInspectionScopes.Photo,
            ScopeKey = $"{taskId}:slot:water:2",
            FileName = "water.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 512,
            UploadedByUserId = "test-user",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        using var payload = JsonDocument.Parse(
            $$"""
            {
              "definedPhotos": {
                "front": {
                  "photos": [
                    {
                      "id": 1,
                      "fileName": "front.jpg",
                      "attachmentId": "{{attachmentId}}"
                    }
                  ]
                }
              }
            }
            """);

        var verifier = new FieldInspectionAttachmentVerifier(db);
        var errors = await verifier.VerifyAsync(taskId, payload.RootElement);

        Assert.Contains("definedPhotos", errors.Keys);
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"attachment-verifier-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }
}
