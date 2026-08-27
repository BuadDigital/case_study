using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PlatformAuditLogAppend(PlatformDbContext db) : IAuditLogAppend
{
    public async Task AppendAsync(AuditLog entry, CancellationToken cancellationToken = default)
    {
        db.AuditLogs.Add(entry);
        await db.SaveChangesAsync(cancellationToken);
    }
}
