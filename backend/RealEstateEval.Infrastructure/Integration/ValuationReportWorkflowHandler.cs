using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Integration;

public sealed class ValuationReportWorkflowHandler
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly ApplicationDbContext _db;
    private readonly IWorkflowTaskService _tasks;
    private readonly ILogger<ValuationReportWorkflowHandler> _logger;

    public ValuationReportWorkflowHandler(
        ApplicationDbContext db,
        IWorkflowTaskService tasks,
        ILogger<ValuationReportWorkflowHandler> logger)
    {
        _db = db;
        _tasks = tasks;
        _logger = logger;
    }

    public async Task HandleEnvelopeAsync(string payloadJson, CancellationToken cancellationToken = default)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        var root = doc.RootElement;
        var eventType = root.TryGetProperty("eventType", out var et)
            ? et.GetString()
            : root.GetProperty("EventType").GetString();

        if (!string.Equals(eventType, IntegrationEventTypes.ValuationReportSubmitted, StringComparison.Ordinal))
            return;

        var payloadElement = root.TryGetProperty("payload", out var p) ? p : root.GetProperty("Payload");
        var payload = payloadElement.Deserialize<ValuationReportSubmittedPayload>(JsonOpts);
        if (payload is null)
        {
            _logger.LogWarning("ValuationReportSubmitted payload missing or invalid");
            return;
        }

        await HandleAsync(payload, cancellationToken);
    }

    public async Task HandleAsync(
        ValuationReportSubmittedPayload payload,
        CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParse(payload.PropertyId, out var propertyId))
        {
            _logger.LogWarning(
                "ValuationReportSubmitted: property id {PropertyId} is not a GUID",
                payload.PropertyId);
            return;
        }

        var task = await _db.WorkflowTasks
            .Where(t => t.Kind == "property-appraisal")
            .Where(t => t.PropertyId == propertyId)
            .Where(t => t.Status != WorkflowTaskStatus.Completed && t.Status != WorkflowTaskStatus.Cancelled)
            .OrderByDescending(t => t.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (task is null)
        {
            _logger.LogInformation(
                "ValuationReportSubmitted: no open property-appraisal task for property {PropertyId}",
                propertyId);
            return;
        }

        await _tasks.PatchAsync(
            task.Id,
            new PatchWorkflowTaskRequest { Status = WorkflowTaskStatus.Completed, Phase = "done" },
            cancellationToken);

        _logger.LogInformation(
            "ValuationReportSubmitted: completed workflow task {TaskId} for VR {DisplayId}",
            task.Id,
            payload.DisplayId);
    }
}
