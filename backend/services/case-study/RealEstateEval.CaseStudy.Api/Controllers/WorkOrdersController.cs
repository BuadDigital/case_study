using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;

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

 /// <summary>
 /// Work-order list. Sending page or pageSize returns PagedResultDto; without them the response
 /// stays the plain array every existing caller expects. See
 /// docs/architecture/pagination-contract.md.
 /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? sort,
        [FromQuery] string? dir,
        [FromQuery] string? q,
        [FromQuery] string? status,
        [FromQuery] string? type,
        CancellationToken cancellationToken)
    {
        var actor = await ActorAsync(cancellationToken);
        var query = new WorkOrderListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            Status = status,
            Type = type,
        };

        if (query.IsPaged)
            return Ok(await _workOrders.ListPagedAsync(query, actor, cancellationToken));

        return Ok(await _workOrders.ListAsync(query, actor, cancellationToken));
    }

    [HttpGet("details")]
    public async Task<ActionResult<IReadOnlyList<WorkOrderDto>>> ListDetails(
        CancellationToken cancellationToken)
    {
        return Ok(await _workOrders.ListDetailsAsync(
            await ActorAsync(cancellationToken),
            cancellationToken));
    }

    [HttpGet("property-rows")]
    public async Task<ActionResult<IReadOnlyList<PropertyListItemDto>>> ListPropertyRows(
        CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "private, max-age=60";
        return Ok(await _workOrders.ListPropertyListItemsAsync(
            await ActorAsync(cancellationToken),
            cancellationToken));
    }

    [HttpGet("exists")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<bool>> Exists(
        [FromQuery] string poNumber,
        CancellationToken cancellationToken)
    {
        return Ok(await _workOrders.ExistsAsync(poNumber, cancellationToken));
    }

    [HttpGet("properties/pending-bourse")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<IReadOnlyList<PendingBoursePropertyDto>>> ListPendingBourse(
        CancellationToken cancellationToken)
    {
        return Ok(await _workOrders.ListPendingBourseAsync(cancellationToken));
    }

    [HttpGet("deeds/prior")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PriorDeedRegistrationDto>> FindPriorDeed(
        [FromQuery] string deedNumber,
        [FromQuery] string? excludePo,
        [FromQuery] Guid? excludePropertyId,
        CancellationToken cancellationToken)
    {
        var hit = await _workOrders.FindPriorDeedAsync(
            deedNumber,
            excludePo,
            cancellationToken,
            excludePropertyId);
        return this.OkOrEmpty(hit);
    }

 /// <summary>
 /// All prior registrations for a deed (newest first), not only the latest.
 /// </summary>
    [HttpGet("deeds/prior/history")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<IReadOnlyList<PriorDeedRegistrationDto>>> ListPriorDeedHistory(
        [FromQuery] string deedNumber,
        [FromQuery] string? excludePo,
        [FromQuery] Guid? excludePropertyId,
        [FromQuery] int take = 20,
        CancellationToken cancellationToken = default)
    {
        var hits = await _workOrders.ListPriorDeedsAsync(
            deedNumber,
            excludePo,
            cancellationToken,
            excludePropertyId,
            take);
        return Ok(hits);
    }

    [HttpGet("{poNumber}")]
    public async Task<ActionResult<WorkOrderDto>> Get(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var dto = await _workOrders.GetByPoNumberAsync(
            poNumber,
            await ActorAsync(cancellationToken),
            cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpGet("{poNumber}/properties/{propertyId:guid}/timeline")]
    public async Task<ActionResult<IReadOnlyList<PropertyTimelineEventDto>>> GetPropertyTimeline(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var actor = await ActorAsync(cancellationToken);
        var order = await _workOrders.GetByPoNumberAsync(poNumber, actor, cancellationToken);
        if (order is null) return NotFound();
        return Ok(await _timeline.GetForPropertyAsync(poNumber, propertyId, cancellationToken));
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkOrderDto>> Create(
        [FromBody] CreateWorkOrderRequest request,
        CancellationToken cancellationToken)
    {
        var forbidden = await ForbidUnlessAsync(
            PoRoleMatrixRules.CanReceivePo,
            cancellationToken,
            "تسجيل أمر العمل متاح لأخصائي دراسة الحالة أو مشرف القسم فقط");
        if (forbidden is not null) return forbidden;

        var (result, errors) = await _workOrders.CreateAsync(
            request,
            cancellationToken);
        if (errors is { Count: > 0 })
            return this.FieldErrorsProblem(errors);
        return CreatedAtAction(nameof(Get), new { poNumber = result!.PoNumber }, result);
    }

    [HttpPut("{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkOrderDto>> UpdateHeader(
        string poNumber,
        [FromBody] UpdateWorkOrderHeaderRequest request,
        CancellationToken cancellationToken)
    {
        var forbidden = await ForbidUnlessAsync(PoRoleMatrixRules.CanEditPoHeader, cancellationToken);
        if (forbidden is not null) return forbidden;

        var (result, errors) = await _workOrders.UpdateHeaderAsync(
            poNumber,
            request,
            cancellationToken);
        if (errors is { Count: > 0 })
            return this.FieldErrorsProblem(errors);
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> Delete(string poNumber, CancellationToken cancellationToken)
    {
        var forbidden = await ForbidUnlessAsync(PoRoleMatrixRules.CanDeletePo, cancellationToken);
        if (forbidden is not null) return forbidden;

        var (ok, error) = await _workOrders.DeleteAsync(poNumber, cancellationToken);
        if (!ok) return this.BadRequestProblem(error ?? "تعذر تنفيذ العملية.");
        return NoContent();
    }

    [HttpPost("{poNumber}/cancel")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> Cancel(string poNumber, CancellationToken cancellationToken)
    {
        var forbidden = await ForbidUnlessAsync(PoRoleMatrixRules.CanEditPoHeader, cancellationToken);
        if (forbidden is not null) return forbidden;

        var (ok, error) = await _workOrders.CancelAsync(poNumber, cancellationToken);
        if (!ok) return this.BadRequestProblem(error ?? "تعذر تنفيذ العملية.");
        return NoContent();
    }

    [HttpPost("{poNumber}/stop")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> Stop(string poNumber, CancellationToken cancellationToken)
    {
        var forbidden = await ForbidUnlessAsync(PoRoleMatrixRules.CanEditPoHeader, cancellationToken);
        if (forbidden is not null) return forbidden;

        var (ok, error) = await _workOrders.StopAsync(poNumber, cancellationToken);
        if (!ok) return this.BadRequestProblem(error ?? "تعذر تنفيذ العملية.");
        return NoContent();
    }

    [HttpPost("{poNumber}/properties")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkOrderPropertyDto>> AddProperty(
        string poNumber,
        [FromBody] WorkOrderPropertyDto property,
        CancellationToken cancellationToken)
    {
        var forbidden = await ForbidUnlessAsync(PoRoleMatrixRules.CanReceivePo, cancellationToken);
        if (forbidden is not null) return forbidden;

        var (result, errors) = await _workOrders.AddPropertyAsync(
            poNumber,
            property,
            cancellationToken);
        if (errors is { Count: > 0 })
            return this.FieldErrorsProblem(errors);
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
        var forbidden = await ForbidUnlessAsync(PoRoleMatrixRules.CanEditProperty, cancellationToken);
        if (forbidden is not null) return forbidden;

        var (result, errors) = await _workOrders.CompleteBourseDataAsync(
            poNumber,
            propertyId,
            request,
            cancellationToken);
        if (errors is { Count: > 0 })
            return this.FieldErrorsProblem(errors);
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
        var forbidden = await ForbidUnlessAsync(PoRoleMatrixRules.CanEditProperty, cancellationToken);
        if (forbidden is not null) return forbidden;

        var (result, errors) = await _workOrders.UpdatePropertyAsync(
            poNumber,
            propertyId,
            property,
            cancellationToken);
        if (errors is { Count: > 0 })
            return this.FieldErrorsProblem(errors);
        if (result is null) return NotFound();
        return Ok(result);
    }

 /// <summary>
 /// Narrow write for location map URL — specialist / inspector / supervisor / CDO.
 /// Does not require manage-work-orders (inspectors only have submit-party-work).
 /// </summary>
    [HttpPut("{poNumber}/properties/{propertyId:guid}/location-map-url")]
    public async Task<ActionResult<WorkOrderPropertyDto>> UpdateLocationMapUrl(
        string poNumber,
        Guid propertyId,
        [FromBody] UpdateLocationMapUrlRequest request,
        CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId) || userId == "unknown") return Forbid();
        var perms = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        if (!DocumentaryWorkflowRules.RoleCanSetLocationMapUrl(perms?.PrototypeRole))
            return Forbid();

        var (result, errors) = await _workOrders.UpdateLocationMapUrlAsync(
            poNumber,
            propertyId,
            request.LocationMapUrl,
            cancellationToken);
        if (errors is { Count: > 0 })
            return this.FieldErrorsProblem(errors);
        if (result is null) return NotFound();
        return Ok(result);
    }

 /// <summary>
 /// Narrow write for specialist valuation extras (ESG / search scope / print keys / Infath deposit).
 /// Allowed for case staff (manage work orders) and party submitters.
 /// </summary>
    [HttpPut("{poNumber}/properties/{propertyId:guid}/specialist-report-extras")]
    public async Task<ActionResult<WorkOrderPropertyDto>> UpdateSpecialistReportExtras(
        string poNumber,
        Guid propertyId,
        [FromBody] UpdateSpecialistReportExtrasRequest request,
        CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId) || userId == "unknown") return Forbid();
        var perms = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        var canWrite =
            PoRoleMatrixRules.CanEditProperty(perms?.PrototypeRole)
            || DocumentaryWorkflowRules.RoleCanSetLocationMapUrl(perms?.PrototypeRole)
            || string.Equals(perms?.PrototypeRole, "real-estate-appraiser", StringComparison.OrdinalIgnoreCase)
            || string.Equals(perms?.PrototypeRole, "report-preparer", StringComparison.OrdinalIgnoreCase);
        if (!canWrite)
            return Forbid();

        var (result, errors) = await _workOrders.UpdateSpecialistReportExtrasAsync(
            poNumber,
            propertyId,
            request.SpecialistReportExtrasJson,
            cancellationToken);
        if (errors is { Count: > 0 })
            return this.FieldErrorsProblem(errors);
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("{poNumber}/properties/{propertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> DeleteProperty(
        string poNumber,
        Guid propertyId,
        [FromBody] DeleteWorkOrderPropertyRequest? request,
        CancellationToken cancellationToken)
    {
        var forbidden = await ForbidUnlessAsync(PoRoleMatrixRules.CanDeleteProperty, cancellationToken);
        if (forbidden is not null) return forbidden;

        var (ok, error) = await _workOrders.DeletePropertyAsync(
            poNumber,
            propertyId,
            request?.Reason ?? "",
            cancellationToken);
        if (!ok) return this.BadRequestProblem(error ?? "تعذر تنفيذ العملية.");
        return NoContent();
    }

    private async Task<PermissionsDto?> ActorAsync(CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId) || userId == "unknown")
            return null;
        return await _permissions.GetForUserIdAsync(userId, cancellationToken);
    }

    private async Task<ActionResult?> ForbidUnlessAsync(
        Func<string?, bool> allow,
        CancellationToken cancellationToken,
        string? forbiddenMessage = null)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId) || userId == "unknown") return Forbid();
        var perms = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        if (!allow(perms?.PrototypeRole))
            return this.ForbiddenProblem(forbiddenMessage ?? "ليس لديك صلاحية لهذا الإجراء");
        return null;
    }
}
