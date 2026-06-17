using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Integration;

public sealed class ValuationRequestCreatedHandler
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly ApplicationDbContext _db;
    private readonly ILogger<ValuationRequestCreatedHandler> _logger;

    public ValuationRequestCreatedHandler(
        ApplicationDbContext db,
        ILogger<ValuationRequestCreatedHandler> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task HandleEnvelopeAsync(string payloadJson, CancellationToken cancellationToken = default)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        var root = doc.RootElement;
        var eventType = root.TryGetProperty("eventType", out var et)
            ? et.GetString()
            : root.GetProperty("EventType").GetString();

        if (!string.Equals(eventType, IntegrationEventTypes.ValuationRequestCreated, StringComparison.Ordinal))
            return;

        var payloadElement = root.TryGetProperty("payload", out var p) ? p : root.GetProperty("Payload");
        var payload = payloadElement.Deserialize<ValuationRequestCreatedPayload>(JsonOpts);
        if (payload is null)
        {
            _logger.LogWarning("ValuationRequestCreated payload missing or invalid");
            return;
        }

        await HandleAsync(payload, cancellationToken);
    }

    public async Task HandleAsync(
        ValuationRequestCreatedPayload payload,
        CancellationToken cancellationToken = default)
    {
        var po = string.IsNullOrWhiteSpace(payload.PoNumber) ? "(unknown)" : payload.PoNumber;
        _logger.LogInformation(
            "ValuationRequestCreated: VR {ValuationRequestId} for property {PropertyId} on PO {PoNumber}",
            payload.ValuationRequestId,
            payload.PropertyId,
            po);

        if (!Guid.TryParse(payload.PropertyId, out var propertyId))
            return;

        var hasOpenAppraisal = await _db.WorkflowTasks.AsNoTracking()
            .AnyAsync(
                t => t.Kind == "property-appraisal"
                     && t.PropertyId == propertyId
                     && t.Status != "completed"
                     && t.Status != "cancelled",
                cancellationToken);

        if (!hasOpenAppraisal)
        {
            _logger.LogInformation(
                "ValuationRequestCreated: no open property-appraisal task for property {PropertyId}",
                propertyId);
        }
    }
}
