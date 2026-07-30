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

        var maintenance = _services.GetRequiredService<ISystemMaintenanceService>();
        return Ok(await maintenance.ResetAllOperationalDataAsync(cancellationToken));
    }
}
