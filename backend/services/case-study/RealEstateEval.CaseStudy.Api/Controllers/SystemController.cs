using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/system")]
[Authorize(Policy = CapabilityPolicyNames.ResetSystemData)]
public class SystemController : ControllerBase
{
    private readonly ISystemMaintenanceService _maintenance;
    private readonly IWebHostEnvironment _env;

    public SystemController(
        ISystemMaintenanceService maintenance,
        IWebHostEnvironment env)
    {
        _maintenance = maintenance;
        _env = env;
    }

    /// <summary>Development only — wipes operational + prototype config data; keeps seeded org accounts; re-seeds demo catalog rows.</summary>
    [HttpDelete("data")]
    public async Task<ActionResult<SystemResetResultDto>> ResetAllData(
        CancellationToken cancellationToken)
    {
        if (!_env.IsDevelopment())
            return NotFound();

        return Ok(await _maintenance.ResetAllOperationalDataAsync(cancellationToken));
    }
}
