using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpAuditLogAppend(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IAuditLogAppend
{
    public Task AppendAsync(AuditLog entry, CancellationToken cancellationToken = default) =>
        UpstreamJson.PostAsync(
            http,
            httpContext,
            options.Value.PlatformBaseUrl,
            "/api/audit-log/append",
            new AppendAuditLogRequest
            {
                ActorId = entry.ActorId,
                Action = entry.Action,
                EntityType = entry.EntityType,
                EntityId = entry.EntityId,
                BeforeJson = entry.BeforeJson,
                AfterJson = entry.AfterJson,
                CreatedAtUtc = entry.CreatedAtUtc,
            },
            "UpstreamServices:PlatformBaseUrl",
            cancellationToken);
}
