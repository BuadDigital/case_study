using RealEstateEval.Attachments.Application.Abstractions;

namespace RealEstateEval.Application.Tests;

/// <summary>One file kept by <see cref="FakeAttachmentFileStore"/>.</summary>
public sealed record FakeStoredFile(Guid Id, string Scope, string ScopeKey, string FileName, byte[] Content);

/// <summary>
/// In-memory stand-in for the attachments service's file store (deposit certificates, final report PDFs).
/// How it works: every store gets a new id and is kept in <see cref="Stored"/>; deletes are recorded in
/// <see cref="Deleted"/> and hide the file from reads. Set <see cref="FailWith"/> to make stores fail.
/// Moved here 2026-11-10 from ValuationFinalReportTests: the issuance service now always needs a store.
/// </summary>
public sealed class FakeAttachmentFileStore : IAttachmentFileStore
{
    public List<FakeStoredFile> Stored { get; } = [];
    public List<Guid> Deleted { get; } = [];
    public string? FailWith { get; set; }
    public Action<string>? OnStore { get; set; }

    public Task<(Guid? Id, string? Error)> StoreAsync(
        string scope, string scopeKey, string fileName, string contentType, byte[] content,
        CancellationToken cancellationToken = default)
    {
        if (FailWith is not null) return Task.FromResult<(Guid?, string?)>((null, FailWith));
        var id = Guid.NewGuid();
        Stored.Add(new FakeStoredFile(id, scope, scopeKey, fileName, content));
        OnStore?.Invoke(scope);
        return Task.FromResult<(Guid?, string?)>((id, null));
    }

    public Task<byte[]?> ReadAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Stored.FirstOrDefault(f => f.Id == id && !Deleted.Contains(id))?.Content);

    public Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        Deleted.Add(id);
        return Task.CompletedTask;
    }
}
