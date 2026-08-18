using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/workflow-assignees")]
[Authorize]
public sealed class WorkflowAssigneesController(IWorkflowAssigneeLookup lookup) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<WorkflowAssigneeIdsDto>> Get(
        [FromQuery] Guid? propertyId,
        [FromQuery] string? poNumber,
        [FromQuery] string kinds,
        CancellationToken cancellationToken)
    {
        var parsed = ParseKinds(kinds);
        if (parsed.Count == 0)
            return this.BadRequestProblem("kinds is required");

        IReadOnlyList<string> ids;
        if (propertyId is Guid pid)
            ids = await lookup.GetOpenAssigneeIdsForPropertyAsync(pid, parsed, cancellationToken);
        else if (!string.IsNullOrWhiteSpace(poNumber))
            ids = await lookup.GetOpenAssigneeIdsForPoAsync(poNumber, parsed, cancellationToken);
        else
            return this.BadRequestProblem("propertyId or poNumber is required");

        return Ok(new WorkflowAssigneeIdsDto { AssigneeIds = ids });
    }

    private static List<WorkflowTaskKind> ParseKinds(string? kinds)
    {
        var list = new List<WorkflowTaskKind>();
        foreach (var part in (kinds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (Enum.TryParse<WorkflowTaskKind>(part, ignoreCase: true, out var kind))
                list.Add(kind);
        }

        return list;
    }
}
