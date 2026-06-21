using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/internal-delegation-letters")]
[Authorize]
public class InternalDelegationLettersController : ControllerBase
{
    private readonly IInternalDelegationLettersService _letters;

    public InternalDelegationLettersController(IInternalDelegationLettersService letters)
        => _letters = letters;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InternalDelegationLetterDto>>> Get(
        [FromQuery] string poNumber,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(poNumber))
            return BadRequest(new { error = "poNumber is required" });

        return Ok(await _letters.GetForPoAsync(poNumber, ct));
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<IReadOnlyList<InternalDelegationLetterDto>>> Save(
        [FromBody] SaveInternalDelegationLettersRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.PoNumber))
            return BadRequest(new { error = "poNumber is required" });

        return Ok(await _letters.SaveAsync(request, ct));
    }
}
