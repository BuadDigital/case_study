using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/work-orders")]
[Authorize]
public class WorkOrdersController : ControllerBase
{
    private readonly IWorkOrderService _workOrders;

    public WorkOrdersController(IWorkOrderService workOrders)
    {
        _workOrders = workOrders;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkOrderListItemDto>>> List(
        CancellationToken cancellationToken)
    {
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
