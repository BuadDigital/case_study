using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Infrastructure.Storage;

public sealed class LocalFileBlobStorage : IBlobStorage
{
    private readonly string _root;
    private readonly ILogger<LocalFileBlobStorage> _logger;

    public LocalFileBlobStorage(IOptions<BlobStorageOptions> options, ILogger<LocalFileBlobStorage> logger)
    {
        _root = Path.GetFullPath(options.Value.LocalRootPath);
        _logger = logger;
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveAsync(
        string container,
        string blobName,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        var storageKey = $"{container.Trim('/')}/{blobName.Trim('/')}";
        var fullPath = ToFullPath(storageKey);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllBytesAsync(fullPath, content, cancellationToken);
        _logger.LogDebug("Saved blob {StorageKey} ({Bytes} bytes)", storageKey, content.Length);
        return storageKey;
    }

    public async Task<byte[]?> ReadAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var fullPath = ToFullPath(storageKey);
        if (!File.Exists(fullPath))
            return null;
        return await File.ReadAllBytesAsync(fullPath, cancellationToken);
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var fullPath = ToFullPath(storageKey);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            _logger.LogDebug("Deleted blob {StorageKey}", storageKey);
        }

        return Task.CompletedTask;
    }

    private string ToFullPath(string storageKey)
    {
        var relative = storageKey.Replace('/', Path.DirectorySeparatorChar);
        var combined = Path.GetFullPath(Path.Combine(_root, relative));
        if (!combined.StartsWith(_root, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Invalid blob storage key path.");
        return combined;
    }
}
