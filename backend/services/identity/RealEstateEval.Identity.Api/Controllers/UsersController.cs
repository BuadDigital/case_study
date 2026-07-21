using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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

    [HttpPost]
    public async Task<ActionResult<CreateStaffUserResponseDto>> Create(
        [FromBody] CreateStaffUserRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _users.CreateStaffAsync(request, cancellationToken);
        if (errors is not null)
            return BadRequest(new FieldErrorsResponseDto { Errors = errors });

        return Ok(result);
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

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(
        string id,
        CancellationToken cancellationToken)
    {
        var requestingUserId =
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        var (ok, error) = await _users.DeleteStaffAsync(
            id,
            requestingUserId,
            cancellationToken);

        if (!ok)
            return BadRequest(new FieldErrorsResponseDto
            {
                Errors = new Dictionary<string, string>
                {
                    ["_form"] = error ?? "تعذر حذف المستخدم.",
                },
            });

        return NoContent();
    }
}
