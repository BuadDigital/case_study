using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// Authenticated lookups used by Financial and Operations. Operator work-order and
/// workflow-task routes keep their capability policies.
/// </summary>
[ApiController]
[Route("api/case-study-dispatch")]
[Authorize]
public sealed class CaseStudyDispatchController(ICaseStudyLookup lookup) : ControllerBase
{
    [HttpGet("completed-case-study-property-ids")]
    public async Task<ActionResult<IReadOnlyList<Guid>>> CompletedCaseStudyPropertyIds(
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListCompletedCaseStudyPropertyIdsAsync(cancellationToken));

    [HttpGet("workflow-task-kinds")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyWorkflowTaskKindDto>>> WorkflowTaskKinds(
        [FromQuery] string? ids,
        CancellationToken cancellationToken)
    {
        var parsed = ParseGuids(ids);
        var kinds = await lookup.GetWorkflowTaskKindsAsync(parsed, cancellationToken);
        return Ok(kinds.Select(kv => new CaseStudyWorkflowTaskKindDto
        {
            Id = kv.Key,
            Kind = kv.Value.ToString(),
        }).ToList());
    }

    [HttpGet("work-order-summaries")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyWorkOrderSummaryDto>>> WorkOrderSummaries(
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListWorkOrderSummariesAsync(cancellationToken));

    [HttpGet("properties/{propertyId:guid}")]
    public async Task<ActionResult<CaseStudyPropertySnapshotDto>> GetProperty(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var dto = await lookup.GetPropertyAsync(propertyId, cancellationToken);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("properties")]
    public async Task<ActionResult<CaseStudyPropertySnapshotDto>> GetPropertyByPoAndDeed(
        [FromQuery] string? poNumber,
        [FromQuery] string? deedNumber,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(poNumber) || string.IsNullOrWhiteSpace(deedNumber))
            return this.BadRequestProblem("poNumber and deedNumber are required");

        var dto = await lookup.GetPropertyByPoAndDeedAsync(poNumber, deedNumber, cancellationToken);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("properties-by-po")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyPropertySnapshotDto>>> PropertiesByPo(
        [FromQuery] string? poNumbers,
        CancellationToken cancellationToken)
    {
        var parsed = ParseCsv(poNumbers);
        return Ok(await lookup.ListPropertiesByPoNumbersAsync(parsed, cancellationToken));
    }

    [HttpGet("properties-by-request")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyPropertySnapshotDto>>> PropertiesByRequest(
        [FromQuery] string? requestNumbers,
        CancellationToken cancellationToken)
    {
        var parsed = ParseCsv(requestNumbers);
        return Ok(await lookup.ListPropertiesByRequestNumbersAsync(parsed, cancellationToken));
    }

    [HttpGet("case-specialist-assignee")]
    public async Task<ActionResult<CaseStudyAssigneeDto>> CaseSpecialistAssignee(
        [FromQuery] Guid propertyId,
        CancellationToken cancellationToken)
    {
        if (propertyId == Guid.Empty)
            return this.BadRequestProblem("propertyId is required");

        var assigneeId = await lookup.GetCaseSpecialistAssigneeAsync(propertyId, cancellationToken);
        return Ok(new CaseStudyAssigneeDto { AssigneeId = assigneeId });
    }

    [HttpGet("gov-review-key-statuses")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyGovReviewKeyStatusDto>>> GovReviewKeyStatuses(
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListGovReviewKeyStatusesAsync(cancellationToken));

    [HttpGet("properties-by-id")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyPropertySnapshotDto>>> PropertiesById(
        [FromQuery] string? ids,
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListPropertiesByIdsAsync(ParseGuids(ids), cancellationToken));

    [HttpGet("workflow-tasks/{taskId:guid}")]
    public async Task<ActionResult<CaseStudyWorkflowTaskSnapshotDto>> GetWorkflowTask(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dto = await lookup.GetWorkflowTaskAsync(taskId, cancellationToken);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("workflow-tasks")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>> WorkflowTasksByIds(
        [FromQuery] string? ids,
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListWorkflowTasksByIdsAsync(ParseGuids(ids), cancellationToken));

    [HttpGet("workflow-tasks-by-property")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>> WorkflowTasksByProperty(
        [FromQuery] Guid propertyId,
        [FromQuery] string? kinds,
        CancellationToken cancellationToken)
    {
        if (propertyId == Guid.Empty)
            return this.BadRequestProblem("propertyId is required");

        return Ok(await lookup.ListWorkflowTasksByPropertyAsync(
            propertyId,
            ParseKinds(kinds),
            cancellationToken));
    }

    [HttpGet("workflow-tasks-by-kind")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>> WorkflowTasksByKind(
        [FromQuery] string? kinds,
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListWorkflowTasksByKindsAsync(ParseKinds(kinds), cancellationToken));

    [HttpGet("workflow-tasks-by-po")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>> WorkflowTasksByPo(
        [FromQuery] string? poNumbers,
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListWorkflowTasksByPoNumbersAsync(ParseCsv(poNumbers), cancellationToken));

    [HttpGet("party-task-submissions")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyPartyTaskSubmissionSnapshotDto>>> PartyTaskSubmissions(
        [FromQuery] string? ids,
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListPartyTaskSubmissionsByTaskIdsAsync(ParseGuids(ids), cancellationToken));

    [HttpGet("field-inspection-workspaces")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyFieldInspectionWorkspaceSnapshotDto>>> FieldInspectionWorkspaces(
        [FromQuery] string? ids,
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListFieldInspectionWorkspacesByTaskIdsAsync(ParseGuids(ids), cancellationToken));

    [HttpGet("work-order-id")]
    public async Task<ActionResult<CaseStudyWorkOrderIdDto>> WorkOrderId(
        [FromQuery] string? poNumber,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(poNumber))
            return this.BadRequestProblem("poNumber is required");

        var id = await lookup.GetWorkOrderIdByPoNumberAsync(poNumber, cancellationToken);
        return id is null ? NotFound() : Ok(new CaseStudyWorkOrderIdDto { Id = id });
    }

    [HttpGet("work-order-received-at")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyWorkOrderReceivedAtDto>>> WorkOrderReceivedAt(
        [FromQuery] string? poNumbers,
        CancellationToken cancellationToken)
    {
        var map = await lookup.GetWorkOrderReceivedAtByPoNumbersAsync(ParseCsv(poNumbers), cancellationToken);
        return Ok(map.Select(kv => new CaseStudyWorkOrderReceivedAtDto
        {
            PoNumber = kv.Key,
            ReceivedFromEnfathAtUtc = kv.Value,
        }).ToList());
    }

    [HttpGet("work-orders-for-billing")]
    public async Task<ActionResult<IReadOnlyList<CaseStudyWorkOrderBillingSnapshotDto>>> WorkOrdersForBilling(
        [FromQuery] int take = 500,
        CancellationToken cancellationToken = default) =>
        Ok(await lookup.ListWorkOrdersForBillingAsync(take, cancellationToken));

    [HttpGet("work-orders-for-billing/{poNumber}")]
    public async Task<ActionResult<CaseStudyWorkOrderBillingSnapshotDto>> WorkOrderForBilling(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var dto = await lookup.GetWorkOrderForBillingAsync(poNumber, cancellationToken);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("document-references")]
    public async Task<ActionResult<CaseStudyDocumentReferenceDto>> AllocateDocumentReference(
        [FromBody] AllocateCaseStudyDocumentReferenceRequest request,
        [FromServices] ICaseStudyCommands commands,
        CancellationToken cancellationToken)
    {
        var (reference, error) = await commands.AllocateDocumentReferenceAsync(
            request.Dept,
            request.Type,
            request.DateKey,
            cancellationToken);
        if (error is not null)
            return this.BadRequestProblem(error);
        return Ok(new CaseStudyDocumentReferenceDto { Reference = reference ?? "" });
    }

    [HttpPost("properties/{propertyId:guid}/backfill-area")]
    public async Task<IActionResult> BackfillPropertyArea(
        Guid propertyId,
        [FromBody] BackfillCaseStudyPropertyAreaRequest request,
        [FromServices] ICaseStudyCommands commands,
        CancellationToken cancellationToken)
    {
        if (request.AreaM2 <= 0m)
            return this.BadRequestProblem("areaM2 must be positive");

        await commands.BackfillPropertyAreaIfEmptyAsync(propertyId, request.AreaM2, cancellationToken);
        return NoContent();
    }

    private static List<Guid> ParseGuids(string? raw)
    {
        var list = new List<Guid>();
        foreach (var part in (raw ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (Guid.TryParse(part, out var id))
                list.Add(id);
        }

        return list;
    }

    private static List<string> ParseCsv(string? raw) =>
        (raw ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(part => part.Length > 0)
            .ToList();

    private static List<WorkflowTaskKind> ParseKinds(string? raw)
    {
        var list = new List<WorkflowTaskKind>();
        foreach (var part in ParseCsv(raw))
        {
            if (WorkflowTaskKindValues.TryParse(part, out var kind)
                || Enum.TryParse(part, true, out kind))
            {
                list.Add(kind);
            }
        }

        return list;
    }
}
