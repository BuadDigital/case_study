using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Attachments.Domain;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class AttachmentLookupTests
{
    [Fact]
    public async Task ListForProperty_does_not_match_substring_scope_keys()
    {
        await using var db = CreateDb();
        var propertyId = "prop-1";
        db.FileAttachments.AddRange(
            Row("prop-1", "owner-1"),
            Row("prop-10", "owner-1"),
            Row("prop-1:front", "owner-1"),
            Row("other-prop-1", "owner-1"));
        await db.SaveChangesAsync();

        var lookup = new AttachmentLookup(db);
        var actor = new PermissionsDto
        {
            UserId = "staff",
            PrototypeRole = "case-specialist",
        };

        var rows = await lookup.ListForPropertyAsync(propertyId, actor);

        Assert.Equal(2, rows.Count);
        Assert.All(rows, r =>
            Assert.True(r.ScopeKey == "prop-1" || r.ScopeKey.StartsWith("prop-1:")));
    }

    [Fact]
    public async Task ListForProperty_hides_foreign_uploads_from_inspector()
    {
        await using var db = CreateDb();
        db.FileAttachments.AddRange(
            Row("prop-1", "owner-1"),
            Row("prop-1:b", "other"));
        await db.SaveChangesAsync();

        var lookup = new AttachmentLookup(db);
        var rows = await lookup.ListForPropertyAsync("prop-1", new PermissionsDto
        {
            UserId = "owner-1",
            PrototypeRole = "field-inspector",
        });

        Assert.Single(rows);
        Assert.Equal("prop-1", rows[0].ScopeKey);
    }

    private static FileAttachment Row(string scopeKey, string uploadedBy) => new()
    {
        Id = Guid.NewGuid(),
        Scope = "field-inspection-photo",
        ScopeKey = scopeKey,
        FileName = "a.jpg",
        ContentType = "image/jpeg",
        SizeBytes = 4,
        UploadedByUserId = uploadedBy,
        CreatedAtUtc = DateTime.UtcNow,
        Content = [0xFF, 0xD8, 0xFF, 0xD9],
    };

    private static AttachmentsDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AttachmentsDbContext>()
            .UseInMemoryDatabase($"attach-lookup-{Guid.NewGuid():N}")
            .Options);
}
