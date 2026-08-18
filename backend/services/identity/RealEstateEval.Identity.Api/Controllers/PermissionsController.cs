using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Identity.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PermissionsController : ControllerBase
{
    private readonly IPermissionService _permissions;

    public PermissionsController(IPermissionService permissions) => _permissions = permissions;

    [HttpGet]
    public async Task<ActionResult<PermissionsDto>> Get(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var dto = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        if (dto is null)
            return Unauthorized();

        return Ok(dto);
    }

    private string? CurrentUserId() => ActorClaims.TryId(User);
}
