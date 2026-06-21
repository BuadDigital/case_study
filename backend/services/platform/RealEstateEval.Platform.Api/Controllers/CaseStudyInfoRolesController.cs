using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/case-study-info-roles")]
[Authorize]
public class CaseStudyInfoRolesController : ControllerBase
{
    private readonly ICaseStudyInfoRolesConfigService _service;

    public CaseStudyInfoRolesController(ICaseStudyInfoRolesConfigService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<CaseStudyInfoRolesConfigDto>> Get(
        CancellationToken cancellationToken)
        => Ok(await _service.GetAsync(cancellationToken));

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<CaseStudyInfoRolesConfigDto>> Save(
        [FromBody] SaveCaseStudyInfoRolesRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.SaveAsync(request, cancellationToken));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
