using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/clients")]
[Route("api/clients/v1")]
[Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
public class ClientsController : ControllerBase
{
    private readonly IClientService _clients;

    public ClientsController(IClientService clients)
    {
        _clients = clients;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClientDto>>> List(
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _clients.ListAsync(includeInactive, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClientDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var row = await _clients.GetAsync(id, cancellationToken);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<ClientDto>> Create(
        [FromBody] UpsertClientRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _clients.CreateAsync(request, cancellationToken);
        if (errors is not null)
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });
        return CreatedAtAction(nameof(Get), new { id = result!.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ClientDto>> Update(
        Guid id,
        [FromBody] UpsertClientRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _clients.UpdateAsync(id, request, cancellationToken);
        if (errors is not null)
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });
        return Ok(result);
    }

    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var (ok, error) = await _clients.DeactivateAsync(id, cancellationToken);
        if (!ok) return BadRequest(new { message = error });
        return NoContent();
    }
}
