using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class AttachmentReadAuthorizationTests
{
    [Fact]
    public async Task GetMeta_hides_foreign_attachment_from_non_manager()
    {
        await using var db = CreateDb();
        var id = await SeedAsync(db, uploadedBy: "owner-1");
        var service = new AttachmentService(db, new MemoryBlobs());

        var meta = await service.GetMetaAsync(id, new PermissionsDto
        {
            UserId = "other-user",
            PrototypeRole = "field-inspector",
        });

        Assert.Null(meta);
    }

    [Fact]
    public async Task GetMeta_returns_attachment_for_uploader()
    {
        await using var db = CreateDb();
        var id = await SeedAsync(db, uploadedBy: "owner-1");
        var service = new AttachmentService(db, new MemoryBlobs());

        var meta = await service.GetMetaAsync(id, new PermissionsDto
        {
            UserId = "owner-1",
            PrototypeRole = "field-inspector",
        });

        Assert.NotNull(meta);
        Assert.Equal(id, meta!.Id);
    }

    [Fact]
    public async Task GetMeta_returns_attachment_for_case_staff()
    {
        await using var db = CreateDb();
        var id = await SeedAsync(db, uploadedBy: "owner-1");
        var service = new AttachmentService(db, new MemoryBlobs());

        var meta = await service.GetMetaAsync(id, new PermissionsDto
        {
            UserId = "staff",
            PrototypeRole = "case-specialist",
        });

        Assert.NotNull(meta);
    }

    [Fact]
    public async Task GetMeta_returns_nothing_when_actor_is_null()
    {
        await using var db = CreateDb();
        var id = await SeedAsync(db, uploadedBy: "owner-1");
        var service = new AttachmentService(db, new MemoryBlobs());

        Assert.Null(await service.GetMetaAsync(id, actor: null));
    }

    [Fact]
    public async Task GetMeta_allows_manage_attachments_capability()
    {
        await using var db = CreateDb();
        var id = await SeedAsync(db, uploadedBy: "owner-1");
        var service = new AttachmentService(db, new MemoryBlobs());

        var meta = await service.GetMetaAsync(id, new PermissionsDto
        {
            UserId = "librarian",
            PrototypeRole = "document-controller",
            Capabilities = [PlatformCapabilities.ManageAttachments],
        });

        Assert.NotNull(meta);
    }

    private static async Task<Guid> SeedAsync(AttachmentsDbContext db, string uploadedBy)
    {
        var id = Guid.NewGuid();
        db.FileAttachments.Add(new FileAttachment
        {
            Id = id,
            Scope = "field-inspection-photo",
            ScopeKey = "task-1",
            FileName = "front.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 4,
            UploadedByUserId = uploadedBy,
            CreatedAtUtc = DateTime.UtcNow,
            Content = [0xFF, 0xD8, 0xFF, 0xD9],
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static AttachmentsDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AttachmentsDbContext>()
            .UseInMemoryDatabase($"attach-read-auth-{Guid.NewGuid():N}")
            .Options);

    private sealed class MemoryBlobs : IBlobStorage
    {
        public Task<string> SaveAsync(
            string container,
            string relativePath,
            byte[] content,
            CancellationToken cancellationToken = default) =>
            Task.FromResult($"{container}/{relativePath}");

        public Task<byte[]?> ReadAsync(
            string storageKey,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<byte[]?>(null);

        public Task DeleteAsync(
            string storageKey,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
