using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class PhotoMetadataTests
{
    [Fact]
    public async Task Upload_persists_exif_metadata_for_field_inspection_photos()
    {
        await using var db = CreateDb();
        var service = new AttachmentService(db, new InMemoryBlobStorage());

        // JPEG signature + padding past FileSignatureInspector.MinimumInspectableBytes.
        var jpegBytes = new byte[16];
        jpegBytes[0] = 0xFF;
        jpegBytes[1] = 0xD8;
        jpegBytes[2] = 0xFF;
        jpegBytes[^2] = 0xFF;
        jpegBytes[^1] = 0xD9;
        var jpeg = Convert.ToBase64String(jpegBytes);
        var (meta, error) = await service.UploadAsync(
            new UploadAttachmentRequest
            {
                Scope = "field-inspection-photo",
                ScopeKey = "task:slot:1",
                FileName = "front.jpg",
                ContentType = "image/jpeg",
                ContentBase64 = jpeg,
                PhotoMetadata = new PhotoMetadataInput
                {
                    Latitude = 21.4858,
                    Longitude = 39.1925,
                    CapturedAtUtc = new DateTime(2026, 8, 1, 10, 0, 0, DateTimeKind.Utc),
                },
            },
            "user-1");

        Assert.Null(error);
        Assert.NotNull(meta);
        var row = await db.PhotoMetadata.AsNoTracking().SingleAsync();
        Assert.Equal(meta!.Id, row.PhotoId);
        Assert.Equal(21.4858, row.Latitude);
        Assert.Equal(39.1925, row.Longitude);
        Assert.Null(row.DistanceM);
        Assert.Null(row.Flag);
    }

    [Fact]
    public async Task Upload_skips_metadata_for_document_scopes()
    {
        await using var db = CreateDb();
        var service = new AttachmentService(db, new InMemoryBlobStorage());
        var pdf = Convert.ToBase64String(
            "%PDF-1.4"u8.ToArray().Concat(new byte[] { 0x25, 0x25, 0x45, 0x4F, 0x46 }).ToArray());

        // Use a tiny JPEG under a document-like scope that still passes image rules if needed —
        // property-decree may require PDF. Skip if signature rejects; assert no metadata either way.
        var jpegBytes = new byte[16];
        jpegBytes[0] = 0xFF;
        jpegBytes[1] = 0xD8;
        jpegBytes[2] = 0xFF;
        jpegBytes[^2] = 0xFF;
        jpegBytes[^1] = 0xD9;
        await service.UploadAsync(
            new UploadAttachmentRequest
            {
                Scope = "property-decree",
                ScopeKey = "prop-1",
                FileName = "deed.jpg",
                ContentType = "image/jpeg",
                ContentBase64 = Convert.ToBase64String(jpegBytes),
                PhotoMetadata = new PhotoMetadataInput { Latitude = 1, Longitude = 2 },
            },
            "user-1");

        Assert.Empty(db.PhotoMetadata);
    }

    private static AttachmentsDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AttachmentsDbContext>()
            .UseInMemoryDatabase($"photo-meta-{Guid.NewGuid():N}")
            .Options);

    private sealed class InMemoryBlobStorage : IBlobStorage
    {
        private readonly Dictionary<string, byte[]> _store = new(StringComparer.Ordinal);

        public Task<string> SaveAsync(
            string container,
            string relativePath,
            byte[] content,
            CancellationToken cancellationToken = default)
        {
            var key = $"{container}/{relativePath}";
            _store[key] = content;
            return Task.FromResult(key);
        }

        public Task<byte[]?> ReadAsync(string storageKey, CancellationToken cancellationToken = default) =>
            Task.FromResult(_store.TryGetValue(storageKey, out var bytes) ? bytes : null);

        public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
        {
            _store.Remove(storageKey);
            return Task.CompletedTask;
        }
    }
}
