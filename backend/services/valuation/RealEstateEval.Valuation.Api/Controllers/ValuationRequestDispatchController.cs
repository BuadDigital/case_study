using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// Authenticated lookup/create used by Case Study appraisal dispatch. Not the
/// operator queue (those routes keep ReadValuationQueue / ManageValuationRequests).
/// </summary>
[ApiController]
[Route("api/valuation-request-dispatch")]
[Authorize]
[RequireUpstreamDispatch]
public sealed class ValuationRequestDispatchController(IValuationRequestService service) : ControllerBase
{
    [HttpGet("open-by-property/{propertyId}")]
    public async Task<ActionResult<ValuationRequestDto>> GetOpenByProperty(
        string propertyId,
        CancellationToken cancellationToken)
    {
        var dto = await service.GetOpenByPropertyAsync(propertyId, cancellationToken);
        return this.OkOrEmpty(dto);
    }

    [HttpPost]
    public async Task<ActionResult<ValuationRequestDto>> Create(
        [FromBody] SaveValuationRequestRequest request,
        CancellationToken cancellationToken)
    {
        var (dto, error) = await service.CreateAsync(request, cancellationToken);
        return error switch
        {
            "valuation_already_open" => this.ConflictProblem(
                "an open valuation request already exists for this property"),
            "duplicate_display_id" => this.ConflictProblem("display id already in use"),
            _ => Ok(dto),
        };
    }
}
