namespace RealEstateEval.Infrastructure.Storage;

public sealed class BlobStorageOptions
{
    public string Provider { get; set; } = "local";
    public string LocalRootPath { get; set; } = "data/blobs";
}
