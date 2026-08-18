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
    private readonly IWebHostEnvironment _env;
    private readonly IServiceProvider _services;

    public SystemController(
        IWebHostEnvironment env,
        IServiceProvider services)
    {
        _env = env;
        _services = services;
    }

 /// <summary>Development only — wipes operational + prototype config data; keeps org admin accounts; re-seeds demo users and catalog rows.</summary>
    [HttpDelete("data")]
    public async Task<ActionResult<SystemResetResultDto>> ResetAllData(
        CancellationToken cancellationToken)
    {
        if (!_env.IsDevelopment())
            return NotFound();

        // Not registered since the per-service database split: the reset walked the legacy
        // god context, which no longer sees live data. Needs a per-owner reset design (A9/A10).
        var maintenance = _services.GetService<ISystemMaintenanceService>();
        if (maintenance is null)
        {
            return Problem(
                statusCode: StatusCodes.Status501NotImplemented,
                title: "System reset is unavailable after the per-service database split.",
                detail: "Resetting demo data now requires per-owner-service resets; see docs/remaining-work.md.");
        }

        return Ok(await maintenance.ResetAllOperationalDataAsync(cancellationToken));
    }
}
