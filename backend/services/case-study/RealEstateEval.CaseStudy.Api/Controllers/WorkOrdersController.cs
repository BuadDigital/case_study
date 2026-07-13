using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/work-orders")]
[Authorize]
public class WorkOrdersController : ControllerBase
{
    private readonly IWorkOrderService _workOrders;
    private readonly IPropertyTimelineService _timeline;
    private readonly IPermissionService _permissions;

    public WorkOrdersController(
        IWorkOrderService workOrders,
        IPropertyTimelineService timeline,
        IPermissionService permissions)
    {
        _workOrders = workOrders;
        _timeline = timeline;
        _permissions = permissions;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        if (page.HasValue || pageSize.HasValue)
            return Ok(await _workOrders.ListPagedAsync(page, pageSize, cancellationToken));

        return Ok(await _workOrders.ListAsync(cancellationToken));
    }

    [HttpGet("details")]
    public async Task<ActionResult<IReadOnlyList<WorkOrderDto>>> ListDetails(
        CancellationToken cancellationToken)
    {
        return Ok(await _workOrders.ListDetailsAsync(cancellationToken));
    }

    [HttpGet("property-rows")]
    public async Task<ActionResult<IReadOnlyList<PropertyListItemDto>>> ListPropertyRows(
        CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "private, max-age=60";
        return Ok(await _workOrders.ListPropertyListItemsAsync(cancellationToken));
    }

    [HttpGet("exists")]
    public async Task<ActionResult<bool>> Exists(
        [FromQuery] string poNumber,
        CancellationToken cancellationToken)
    {
        return Ok(await _workOrders.ExistsAsync(poNumber, cancellationToken));
    }

    [HttpGet("properties/pending-bourse")]
    public async Task<ActionResult<IReadOnlyList<PendingBoursePropertyDto>>> ListPendingBourse(
        CancellationToken cancellationToken)
    {
        return Ok(await _workOrders.ListPendingBourseAsync(cancellationToken));
    }

    [HttpGet("deeds/prior")]
    public async Task<ActionResult<PriorDeedRegistrationDto>> FindPriorDeed(
        [FromQuery] string deedNumber,
        [FromQuery] string? excludePo,
        CancellationToken cancellationToken)
    {
        var hit = await _workOrders.FindPriorDeedAsync(deedNumber, excludePo, cancellationToken);
        if (hit is null) return NotFound();
        return Ok(hit);
    }

    [HttpGet("{poNumber}")]
    public async Task<ActionResult<WorkOrderDto>> Get(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var dto = await _workOrders.GetByPoNumberAsync(poNumber, cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpGet("{poNumber}/properties/{propertyId:guid}/timeline")]
    public async Task<ActionResult<IReadOnlyList<PropertyTimelineEventDto>>> GetPropertyTimeline(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        return Ok(await _timeline.GetForPropertyAsync(poNumber, propertyId, cancellationToken));
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkOrderDto>> Create(
        [FromBody] CreateWorkOrderRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _workOrders.CreateAsync(
            request,
            cancellationToken);
        if (errors is { Count: > 0 })
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });
        return CreatedAtAction(nameof(Get), new { poNumber = result!.PoNumber }, result);
    }

    [HttpPut("{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkOrderDto>> UpdateHeader(
        string poNumber,
        [FromBody] UpdateWorkOrderHeaderRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _workOrders.UpdateHeaderAsync(
            poNumber,
            request,
            cancellationToken);
        if (errors is { Count: > 0 })
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> Delete(string poNumber, CancellationToken cancellationToken)
    {
        var (ok, error) = await _workOrders.DeleteAsync(poNumber, cancellationToken);
        if (!ok) return BadRequest(new { message = error });
        return NoContent();
    }

    [HttpPost("{poNumber}/cancel")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> Cancel(string poNumber, CancellationToken cancellationToken)
    {
        var (ok, error) = await _workOrders.CancelAsync(poNumber, cancellationToken);
        if (!ok) return BadRequest(new { message = error });
        return NoContent();
    }

    [HttpPost("{poNumber}/stop")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> Stop(string poNumber, CancellationToken cancellationToken)
    {
        var (ok, error) = await _workOrders.StopAsync(poNumber, cancellationToken);
        if (!ok) return BadRequest(new { message = error });
        return NoContent();
    }

    [HttpPost("{poNumber}/properties")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkOrderPropertyDto>> AddProperty(
        string poNumber,
        [FromBody] WorkOrderPropertyDto property,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _workOrders.AddPropertyAsync(
            poNumber,
            property,
            cancellationToken);
        if (errors is { Count: > 0 })
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpPut("{poNumber}/properties/{propertyId:guid}/bourse")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkOrderPropertyDto>> CompleteBourseData(
        string poNumber,
        Guid propertyId,
        [FromBody] UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _workOrders.CompleteBourseDataAsync(
            poNumber,
            propertyId,
            request,
            cancellationToken);
        if (errors is { Count: > 0 })
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpPut("{poNumber}/properties/{propertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkOrderPropertyDto>> UpdateProperty(
        string poNumber,
        Guid propertyId,
        [FromBody] WorkOrderPropertyDto property,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _workOrders.UpdatePropertyAsync(
            poNumber,
            propertyId,
            property,
            cancellationToken);
        if (errors is { Count: > 0 })
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });
        if (result is null) return NotFound();
        return Ok(result);
    }

    /// <summary>
    /// Narrow write for informal unlock — specialist / inspector / supervisor / CDO.
    /// Does not require manage-work-orders (inspectors only have submit-party-work).
    /// </summary>
    [HttpPut("{poNumber}/properties/{propertyId:guid}/location-map-url")]
    public async Task<ActionResult<WorkOrderPropertyDto>> UpdateLocationMapUrl(
        string poNumber,
        Guid propertyId,
        [FromBody] UpdateLocationMapUrlRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Forbid();
        var perms = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        if (!DocumentaryWorkflowRules.RoleCanSetLocationMapUrl(perms?.PrototypeRole))
            return Forbid();

        var (result, errors) = await _workOrders.UpdateLocationMapUrlAsync(
            poNumber,
            propertyId,
            request.LocationMapUrl,
            cancellationToken);
        if (errors is { Count: > 0 })
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("{poNumber}/properties/{propertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> DeleteProperty(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var (ok, error) = await _workOrders.DeletePropertyAsync(
            poNumber,
            propertyId,
            cancellationToken);
        if (!ok) return BadRequest(new { message = error });
        return NoContent();
    }
}
