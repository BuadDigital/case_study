using System.Text.Json;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Infrastructure.Integration;

/// <summary>
/// The final issuance of the valuation report (deposit code + certificate) is the one event that
/// completes the appraiser's task: submitting the package only hands it to the case specialist and
/// leaves the task open. A package that was never submitted is never completed by this event.
/// </summary>
public sealed class ValuationReportWorkflowHandler
{
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CaseInsensitive;

    private readonly IValuationReportWorkflowTaskLookup _tasksLookup;
    private readonly IWorkflowTaskService _tasks;
    private readonly ILogger<ValuationReportWorkflowHandler> _logger;
    private readonly IPropertyTimelineService? _timeline;
    private readonly TimeProvider _time;

    public ValuationReportWorkflowHandler(
        IValuationReportWorkflowTaskLookup tasksLookup,
        IWorkflowTaskService tasks,
        ILogger<ValuationReportWorkflowHandler> logger,
        IPropertyTimelineService? timeline = null,
        TimeProvider? time = null)
    {
        _tasksLookup = tasksLookup;
        _tasks = tasks;
        _logger = logger;
        _timeline = timeline;
        _time = time ?? TimeProvider.System;
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

        var task = await _tasksLookup.FindOpenAppraisalTaskAsync(propertyId, cancellationToken);

        if (task is null)
        {
            _logger.LogInformation(
                "ValuationReportSubmitted: no open property-appraisal task for property {PropertyId}",
                propertyId);
            return;
        }

        if (!task.PackageSubmitted)
        {
            _logger.LogWarning(
                "ValuationReportSubmitted: appraisal package of task {TaskId} (VR {DisplayId}) was never submitted; task left open",
                task.TaskId,
                payload.DisplayId);
            return;
        }

        await _tasks.PatchAsync(
            task.TaskId,
            new PatchWorkflowTaskRequest
            {
                Status = WorkflowTaskStatusValues.Completed,
                Phase = WorkflowTaskPhaseValues.Done,
            },
            cancellationToken);

        if (_timeline is not null && !string.IsNullOrWhiteSpace(task.PoNumber))
        {
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"appraisal:{task.TaskId}:final-issued",
                WorkflowTaskKindLabels.AppraisalCompletedTitleAr,
                $"صدر التقرير النهائي ({payload.DisplayId}) — اكتمل تقييم العقار",
                "done",
                _time.GetUtcNow().UtcDateTime,
                cancellationToken);
        }

        _logger.LogInformation(
            "ValuationReportSubmitted: completed workflow task {TaskId} for VR {DisplayId}",
            task.TaskId,
            payload.DisplayId);
    }
}
