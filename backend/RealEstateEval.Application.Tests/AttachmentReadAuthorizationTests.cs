using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Attachments.Infrastructure.Services;
using RealEstateEval.Attachments.Domain;

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
    public async Task GetMeta_refuses_manage_attachments_capability_alone()
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

        Assert.Null(meta);
    }

    [Fact]
    public async Task Delete_refuses_foreign_upload_for_field_roles()
    {
        await using var db = CreateDb();
        var id = await SeedAsync(db, uploadedBy: "owner-1");
        var service = new AttachmentService(db, new MemoryBlobs());

        var deleted = await service.DeleteAsync(id, new PermissionsDto
        {
            UserId = "other-inspector",
            PrototypeRole = "field-inspector",
            Capabilities = [PlatformCapabilities.ManageAttachments],
        });

        Assert.False(deleted);
        Assert.NotNull(await db.FileAttachments.FindAsync(id));
    }

    [Fact]
    public async Task OwnValuedDocuments_lists_only_the_actors_own_uploads_by_name_and_status()
    {
        await using var db = CreateDb();
        var scopeKey = "PO-1:prop-1";
        db.FileAttachments.AddRange(
            ValuedRow("inspector-1", scopeKey, "تقرير الآلات", "pending"),
            ValuedRow("inspector-1", scopeKey, "دراسة الدخل", "rejected", "الملف غير واضح"),
            ValuedRow("other-inspector", scopeKey, "ليس لي", "pending"),
            ValuedRow("inspector-1", "PO-1:prop-2", "عقار آخر", "pending"));
        await db.SaveChangesAsync();
        var service = new AttachmentService(db, new MemoryBlobs());

        var mine = await service.ListOwnValuedDocumentsAsync(
            scopeKey,
            new PermissionsDto { UserId = "inspector-1", PrototypeRole = "field-inspector" });

        Assert.Equal(["تقرير الآلات", "دراسة الدخل"], mine.Select(m => m.Name).OrderBy(n => n, StringComparer.Ordinal));
        Assert.Equal("الملف غير واضح", mine.Single(m => m.Name == "دراسة الدخل").ReviewNote);
        Assert.Equal("pending", mine.Single(m => m.Name == "تقرير الآلات").Status);
        Assert.Empty(await service.ListOwnValuedDocumentsAsync(scopeKey, actor: null));

        // The specialist sees every valued document of the property, not only their own.
        var all = await service.ListOwnValuedDocumentsAsync(
            scopeKey,
            new PermissionsDto { UserId = "specialist-1", PrototypeRole = "case-specialist" });
        Assert.Equal(3, all.Count);

        // The uploader may open their own file (the «معاينة» button) — and nobody else outside the trio.
        var firstId = mine[0].Id;
        Assert.NotNull(await service.GetMetaAsync(
            firstId,
            new PermissionsDto { UserId = "inspector-1", PrototypeRole = "field-inspector" }));
        Assert.Null(await service.GetMetaAsync(
            firstId,
            new PermissionsDto { UserId = "inspector-2", PrototypeRole = "field-inspector" }));
    }

    private static FileAttachment ValuedRow(
        string uploadedBy, string scopeKey, string label, string status, string? note = null) => new()
    {
        Id = Guid.NewGuid(),
        Scope = PropertyDocumentTypes.ValuedScope,
        ScopeKey = scopeKey,
        FileName = "doc.pdf",
        ContentType = "application/pdf",
        SizeBytes = 4,
        UploadedByUserId = uploadedBy,
        DocumentTypeKey = PropertyDocumentTypes.ValuedKey,
        CustomDocumentLabel = label,
        ValueDocStatus = status,
        ValueDocReviewNote = note,
        CreatedAtUtc = DateTime.UtcNow,
    };

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
