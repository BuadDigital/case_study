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

        // Registered only in Development (DevSystemMaintenanceService truncates every owner
        // context's database and re-runs the demo seed); other environments stay 501.
        var maintenance = _services.GetService<ISystemMaintenanceService>();
        if (maintenance is null)
        {
            return Problem(
                statusCode: StatusCodes.Status501NotImplemented,
                title: "System reset is only available in Development.",
                detail: "The dev reset truncates the per-service databases and reseeds demo data; it is never registered outside Development.");
        }

        return Ok(await maintenance.ResetAllOperationalDataAsync(cancellationToken));
    }
}
