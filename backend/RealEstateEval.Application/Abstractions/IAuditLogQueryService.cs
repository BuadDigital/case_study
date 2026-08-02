using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IAuditLogQueryService
{
    Task<AuditLogPageDto> ListAsync(
        string? entityType,
        string? entityId,
        string? action,
        string? actorId,
        int page,
        int limit,
        CancellationToken cancellationToken = default);
}
