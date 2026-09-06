using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// In-memory stand-in for the Platform audit ledger. Identity no longer maps an audit table of
/// its own, so tests observe the rows a use case appends through <see cref="IAuditLogAppend"/>.
/// </summary>
public sealed class RecordingAuditLogAppend : IAuditLogAppend
{
    public List<AuditLog> Entries { get; } = [];

    public Task AppendAsync(AuditLog entry, CancellationToken cancellationToken = default)
    {
        Entries.Add(entry);
        return Task.CompletedTask;
    }
}
