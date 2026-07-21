using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Identity.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "CanManageUsers")]
public class UsersController : ControllerBase
{
    private readonly IUserRegistrationService _users;
    private readonly IWebHostEnvironment _env;

    public UsersController(
        IUserRegistrationService users,
        IWebHostEnvironment env)
    {
        _users = users;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserListItemDto>>> List(
        CancellationToken cancellationToken)
    {
        var list = await _users.ListAsync(null, cancellationToken);
        return Ok(list);
    }

    [HttpGet("organization")]
    public async Task<ActionResult<OrganizationOverviewDto>> Organization(
        CancellationToken cancellationToken)
    {
        var overview = await _users.GetOrganizationOverviewAsync(cancellationToken);
        return Ok(overview);
    }

    [HttpDelete("registered")]
    public async Task<ActionResult<DeleteRegisteredUsersResponseDto>> DeleteAllRegistered(
        CancellationToken cancellationToken)
    {
        if (!_env.IsDevelopment())
            return NotFound();

        var deleted = await _users.DeleteAllRegisteredAsync(cancellationToken);
        return Ok(new DeleteRegisteredUsersResponseDto { DeletedCount = deleted });
    }
}
