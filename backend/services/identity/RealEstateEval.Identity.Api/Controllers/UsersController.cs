using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

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
        var sourceScope = ScopeForCurrentUser();
        var list = await _users.ListAsync(sourceScope, cancellationToken);
        return Ok(list);
    }

    [HttpGet("organization")]
    public async Task<ActionResult<OrganizationOverviewDto>> Organization(
        CancellationToken cancellationToken)
    {
        var overview = await _users.GetOrganizationOverviewAsync(cancellationToken);
        return Ok(overview);
    }

    [HttpPost("hr")]
    public async Task<ActionResult<CreateUserResponseDto>> CreateHr(
        [FromBody] RegistrationPayloadDto data,
        CancellationToken cancellationToken)
    {
        if (!CanCreate(RegistrationSource.Hr))
            return Forbid();
        return await Create(data, _users.CreateHrAsync, cancellationToken);
    }

    [HttpPost("proc")]
    public async Task<ActionResult<CreateUserResponseDto>> CreateProc(
        [FromBody] RegistrationPayloadDto data,
        CancellationToken cancellationToken)
    {
        if (!CanCreate(RegistrationSource.Proc))
            return Forbid();
        return await Create(data, _users.CreateProcAsync, cancellationToken);
    }

    [HttpPost("crm")]
    public async Task<ActionResult<CreateUserResponseDto>> CreateCrm(
        [FromBody] RegistrationPayloadDto data,
        CancellationToken cancellationToken)
    {
        if (!CanCreate(RegistrationSource.Crm))
            return Forbid();
        return await Create(data, _users.CreateCrmAsync, cancellationToken);
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

    [HttpPatch("{id}")]
    public async Task<ActionResult<UserListItemDto>> Update(
        string id,
        [FromBody] UpdateUserRequest request,
        CancellationToken cancellationToken)
    {
        var (result, error) = await _users.UpdateUserAsync(
            id,
            request,
            ScopeForCurrentUser(),
            cancellationToken);
        return error switch
        {
            "not_found" => NotFound(),
            "forbidden" => Forbid(),
            null => Ok(result),
            _ => BadRequest(new { error }),
        };
    }

    [HttpPatch("{id}/deactivate")]
    public async Task<ActionResult<UserListItemDto>> Deactivate(
        string id,
        CancellationToken cancellationToken)
    {
        var (result, error) = await _users.DeactivateUserAsync(
            id,
            ScopeForCurrentUser(),
            cancellationToken);
        return error switch
        {
            "not_found" => NotFound(),
            "forbidden" => Forbid(),
            null => Ok(result),
            _ => BadRequest(new { error }),
        };
    }

    private static async Task<ActionResult<CreateUserResponseDto>> Create(
        RegistrationPayloadDto data,
        Func<RegistrationPayloadDto, CancellationToken, Task<(CreateUserResponseDto? Result, Dictionary<string, string>? Errors)>> create,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await create(data, cancellationToken);
        if (errors is { Count: > 0 })
            return new BadRequestObjectResult(new FieldErrorsResponseDto { Errors = errors });

        return new CreatedAtActionResult(
            nameof(List),
            "Users",
            null,
            result);
    }

    private RegistrationSource? ScopeForCurrentUser()
    {
        if (User.IsInRole(OrgRoles.Cdo))
            return null;
        if (User.IsInRole(OrgRoles.HrAdmin))
            return RegistrationSource.Hr;
        if (User.IsInRole(OrgRoles.ProcAdmin))
            return RegistrationSource.Proc;
        if (User.IsInRole(OrgRoles.CrmAdmin))
            return RegistrationSource.Crm;
        return null;
    }

    private bool CanCreate(RegistrationSource targetSource)
    {
        var scope = ScopeForCurrentUser();
        return scope is null || scope == targetSource;
    }
}
