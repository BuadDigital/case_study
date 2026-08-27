using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Identity.Application.Abstractions;

namespace RealEstateEval.Identity.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "CanManageUsers")]
public class UsersController : ControllerBase
{
    private readonly IUserRegistrationService _users;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        IUserRegistrationService users,
        IWebHostEnvironment env,
        ILogger<UsersController> logger)
    {
        _users = users;
        _env = env;
        _logger = logger;
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
        var (result, errors) = await _users.CreateStaffAsync(
            request,
            ActorClaims.Id(User),
            cancellationToken);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);

        return Ok(result);
    }

 /// <summary>
 /// Partial update of one staff account. Absent members keep their stored value, so a
 /// caller can change a single field without resubmitting the whole profile.
 /// </summary>
    [HttpPatch("{id}")]
    public async Task<ActionResult<UserListItemDto>> Update(
        string id,
        [FromBody] UpdateStaffUserRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _users.UpdateStaffAsync(
            id,
            request,
            ActorClaims.Id(User),
            cancellationToken);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);

        return Ok(result);
    }

 /// <summary>Clears an Identity lockout after too many failed sign-in attempts.</summary>
    [HttpPost("{id}/unlock")]
    public async Task<IActionResult> Unlock(
        string id,
        CancellationToken cancellationToken)
    {
        var (ok, error) = await _users.UnlockStaffAsync(
            id,
            ActorClaims.Id(User),
            cancellationToken);

        if (!ok)
            return this.FieldErrorsProblem(new Dictionary<string, string>
            {
                ["_form"] = error ?? "تعذر فك قفل الحساب.",
            });

        return NoContent();
    }

 /// <summary>
 /// Issues a single-use activation ticket so the account holder can set their own
 /// password. Kept off the create response so the secret is only minted when an
 /// administrator explicitly asks for it.
 /// </summary>
    [HttpPost("{id}/activation-ticket")]
    public async Task<ActionResult<ActivationTicketDto>> IssueActivationTicket(
        [FromRoute] IssueActivationTicketRequest request,
        CancellationToken cancellationToken)
    {
        var (ticket, error) = await _users.IssueActivationTicketAsync(
            request.Id,
            ActorClaims.Id(User),
            cancellationToken);
        if (ticket is null)
        {
            _logger.LogInformation(
                "Activation ticket request rejected for user {UserId}",
                request.Id);
            return this.FieldErrorsProblem(
                new Dictionary<string, string>
                {
                    ["_form"] = error ?? "المستخدم غير موجود.",
                },
                StatusCodes.Status404NotFound,
                "Not Found");
        }

        _logger.LogInformation("Activation ticket issued for user {UserId}", request.Id);
        Response.Headers.CacheControl = "no-store";
        return Ok(ticket);
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
        var requestingUserId = ActorClaims.TryId(User);

        var (ok, error) = await _users.DeleteStaffAsync(
            id,
            requestingUserId,
            cancellationToken);

        if (!ok)
            return this.FieldErrorsProblem(new Dictionary<string, string>
            {
                ["_form"] = error ?? "تعذر تعطيل المستخدم.",
            });

        return NoContent();
    }
}
