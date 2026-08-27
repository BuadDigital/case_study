using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Attachments.Infrastructure.Services;
using RealEstateEval.Attachments.Application.Contracts;
using RealEstateEval.Attachments.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class PhotoMetadataTests
{
    [Fact]
    public async Task Upload_persists_exif_and_location_flag_for_field_inspection_photos()
    {
        await using var db = CreateDb();
        var service = new AttachmentService(db, new InMemoryBlobStorage());

        var jpeg = JpegBase64();
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
                    PropertyLatitude = 21.4859,
                    PropertyLongitude = 39.1926,
                },
            },
            "user-1");

        Assert.Null(error);
        Assert.NotNull(meta);
        Assert.NotNull(meta!.PhotoMetadata);
        Assert.Equal(PhotoLocationRules.FlagMatch, meta.PhotoMetadata.Flag);
        Assert.NotNull(meta.PhotoMetadata.DistanceM);
        Assert.True(meta.PhotoMetadata.DistanceM < PhotoLocationRules.MaxMatchDistanceMeters);

        var row = await db.PhotoMetadata.AsNoTracking().SingleAsync();
        Assert.Equal(meta.Id, row.PhotoId);
        Assert.Equal(21.4858, row.Latitude);
        Assert.Equal(PhotoLocationRules.FlagMatch, row.Flag);
        Assert.Equal(DateTimeKind.Utc, row.CapturedAtUtc!.Value.Kind);
    }

    [Fact]
    public async Task Upload_normalizes_unspecified_exif_timestamp_to_utc()
    {
        await using var db = CreateDb();
        var service = new AttachmentService(db, new InMemoryBlobStorage());

        var (meta, error) = await service.UploadAsync(
            new UploadAttachmentRequest
            {
                Scope = "field-inspection-photo",
                ScopeKey = "task:slot:unspecified-date",
                FileName = "front.jpg",
                ContentType = "image/jpeg",
                ContentBase64 = JpegBase64(),
                PhotoMetadata = new PhotoMetadataInput
                {
                    Latitude = 21.4858,
                    Longitude = 39.1925,
                    CapturedAtUtc = new DateTime(2026, 8, 1, 10, 0, 0, DateTimeKind.Unspecified),
                    PropertyLatitude = 21.4858,
                    PropertyLongitude = 39.1925,
                },
            },
            "user-1");

        Assert.Null(error);
        Assert.NotNull(meta);
        var row = await db.PhotoMetadata.AsNoTracking().SingleAsync();
        Assert.Equal(DateTimeKind.Utc, row.CapturedAtUtc!.Value.Kind);
        Assert.Equal(new DateTime(2026, 8, 1, 10, 0, 0, DateTimeKind.Utc), row.CapturedAtUtc);
    }

    [Fact]
    public async Task Upload_flags_outside_property_when_beyond_500m()
    {
        await using var db = CreateDb();
        var service = new AttachmentService(db, new InMemoryBlobStorage());

        var (meta, error) = await service.UploadAsync(
            new UploadAttachmentRequest
            {
                Scope = "field-inspection-photo",
                ScopeKey = "task:slot:2",
                FileName = "far.jpg",
                ContentType = "image/jpeg",
                ContentBase64 = JpegBase64(),
                PhotoMetadata = new PhotoMetadataInput
                {
                    Latitude = 21.4958,
                    Longitude = 39.1925,
                    PropertyLatitude = 21.4858,
                    PropertyLongitude = 39.1925,
                },
            },
            "user-1");

        Assert.Null(error);
        Assert.Equal(PhotoLocationRules.FlagOutsideProperty, meta!.PhotoMetadata!.Flag);
        Assert.True(meta.PhotoMetadata.DistanceM > PhotoLocationRules.MaxMatchDistanceMeters);
    }

    [Fact]
    public async Task Upload_flags_unavailable_when_photo_gps_missing()
    {
        await using var db = CreateDb();
        var service = new AttachmentService(db, new InMemoryBlobStorage());

        var (meta, error) = await service.UploadAsync(
            new UploadAttachmentRequest
            {
                Scope = "field-inspection-photo",
                ScopeKey = "task:slot:3",
                FileName = "nogps.jpg",
                ContentType = "image/jpeg",
                ContentBase64 = JpegBase64(),
                PhotoMetadata = new PhotoMetadataInput
                {
                    PropertyLatitude = 21.4858,
                    PropertyLongitude = 39.1925,
                },
            },
            "user-1");

        Assert.Null(error);
        Assert.Equal(PhotoLocationRules.FlagLocationUnavailable, meta!.PhotoMetadata!.Flag);
        Assert.Null(meta.PhotoMetadata.DistanceM);
    }

    [Fact]
    public async Task Upload_skips_metadata_for_document_scopes()
    {
        await using var db = CreateDb();
        var service = new AttachmentService(db, new InMemoryBlobStorage());

        await service.UploadAsync(
            new UploadAttachmentRequest
            {
                Scope = "property-decree",
                ScopeKey = "prop-1",
                FileName = "deed.jpg",
                ContentType = "image/jpeg",
                ContentBase64 = JpegBase64(),
                PhotoMetadata = new PhotoMetadataInput { Latitude = 1, Longitude = 2 },
            },
            "user-1");

        Assert.Empty(db.PhotoMetadata);
    }

    private static string JpegBase64()
    {
        var jpegBytes = new byte[16];
        jpegBytes[0] = 0xFF;
        jpegBytes[1] = 0xD8;
        jpegBytes[2] = 0xFF;
        jpegBytes[^2] = 0xFF;
        jpegBytes[^1] = 0xD9;
        return Convert.ToBase64String(jpegBytes);
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
