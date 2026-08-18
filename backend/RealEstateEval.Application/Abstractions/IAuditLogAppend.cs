using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Appends a row to the Platform audit ledger. The Platform host uses EF;
/// other hosts call the Platform API after their own SaveChanges.
/// </summary>
public interface IAuditLogAppend
{
    Task AppendAsync(AuditLog entry, CancellationToken cancellationToken = default);
}
