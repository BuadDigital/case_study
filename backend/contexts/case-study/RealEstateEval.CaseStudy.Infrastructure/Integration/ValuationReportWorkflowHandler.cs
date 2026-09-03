using System.Text.Json;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Infrastructure.Integration;

public sealed class ValuationReportWorkflowHandler
{
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CaseInsensitive;

    private readonly IValuationReportWorkflowTaskLookup _tasksLookup;
    private readonly IWorkflowTaskService _tasks;
    private readonly ILogger<ValuationReportWorkflowHandler> _logger;

    public ValuationReportWorkflowHandler(
        IValuationReportWorkflowTaskLookup tasksLookup,
        IWorkflowTaskService tasks,
        ILogger<ValuationReportWorkflowHandler> logger)
    {
        _tasksLookup = tasksLookup;
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

        var taskId = await _tasksLookup.FindOpenAppraisalTaskIdAsync(propertyId, cancellationToken);

        if (taskId is null)
        {
            _logger.LogInformation(
                "ValuationReportSubmitted: no open property-appraisal task for property {PropertyId}",
                propertyId);
            return;
        }

        await _tasks.PatchAsync(
            taskId.Value,
            new PatchWorkflowTaskRequest
            {
                Status = WorkflowTaskStatusValues.Completed,
                Phase = WorkflowTaskPhaseValues.Done,
            },
            cancellationToken);

        _logger.LogInformation(
            "ValuationReportSubmitted: completed workflow task {TaskId} for VR {DisplayId}",
            taskId.Value,
            payload.DisplayId);
    }
}
