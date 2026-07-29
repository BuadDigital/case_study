using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Identity.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IPasswordAuthenticationService _passwordAuthentication;
    private readonly IAuthSessionService _sessions;
    private readonly IPermissionService _permissions;
    private readonly IUserRegistrationService _users;
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;

    public AuthController(
        IPasswordAuthenticationService passwordAuthentication,
        IAuthSessionService sessions,
        IPermissionService permissions,
        IUserRegistrationService users,
        IWebHostEnvironment environment,
        IConfiguration configuration)
    {
        _passwordAuthentication = passwordAuthentication;
        _sessions = sessions;
        _permissions = permissions;
        _users = users;
        _environment = environment;
        _configuration = configuration;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] PasswordLoginRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var result = await _passwordAuthentication.AuthenticateAsync(
            request.Username,
            request.Password,
            cancellationToken);

        return result is null
            ? Unauthorized(new { message = "اسم المستخدم أو كلمة المرور غير صحيحة" })
            : Ok(result);
    }

    [HttpGet("dev-login-users")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<DevLoginUserDto>>> DevLoginUsers(
        CancellationToken cancellationToken)
    {
        if (!IsDevLoginEnabled())
            return NotFound();

        return Ok(await _users.ListDevLoginUsersAsync(cancellationToken));
    }

    [HttpPost("login-username")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> LoginByUsername(
        [FromBody] UsernameLoginRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsDevLoginEnabled())
            return NotFound();

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var username = request.Username.Trim();
        // Same message for missing/disabled users — do not confirm usernames.
        var session = await _sessions.IssueForUsernameAsync(username, cancellationToken);
        return session is null
            ? Unauthorized(new { message = "تعذر تسجيل الدخول" })
            : Ok(session);
    }

    /// <summary>
    /// Exchanges a refresh token for a fresh access token, re-reading roles and
    /// capabilities so permission changes apply without a new login.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Refresh(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var session = await _sessions.RefreshAsync(request.RefreshToken, cancellationToken);
        return session is null
            ? Unauthorized(new { message = "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى" })
            : Ok(session);
    }

    /// <summary>Revokes the whole session family behind the supplied refresh token.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        await _sessions.RevokeAsync(request.RefreshToken, "logout", cancellationToken);
        return NoContent();
    }

    private bool IsDevLoginEnabled() =>
        _environment.IsDevelopment()
        && _configuration.GetValue("Auth:EnableDevLogin", false);

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeDto>> Me(
        [FromQuery] bool includePermissions = true,
        CancellationToken cancellationToken = default)
    {
        var userId =
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _users.GetIdentityUserAsync(userId, cancellationToken);
        if (user is null)
            return Unauthorized();

        PermissionsDto? permissions = null;
        if (includePermissions)
            permissions = await _permissions.GetForUserIdAsync(userId, cancellationToken);

        return Ok(new MeDto
        {
            Id = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            Permissions = permissions,
        });
    }

    /// <summary>Full staff profile for the signed-in user (same shape as users list).</summary>
    [HttpGet("profile")]
    [Authorize]
    public async Task<ActionResult<UserListItemDto>> Profile(
        CancellationToken cancellationToken = default)
    {
        var userId =
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var profile = await _users.GetByUserIdAsync(userId, cancellationToken);
        return profile is null ? Unauthorized() : Ok(profile);
    }
}
