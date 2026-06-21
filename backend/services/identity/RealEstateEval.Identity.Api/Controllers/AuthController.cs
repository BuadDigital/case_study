using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Identity.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IPermissionService _permissions;
    private readonly IWebHostEnvironment _environment;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        IJwtTokenService jwtTokenService,
        IPermissionService permissions,
        IWebHostEnvironment environment)
    {
        _userManager = userManager;
        _jwtTokenService = jwtTokenService;
        _permissions = permissions;
        _environment = environment;
    }

    [HttpPost("login-username")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> LoginByUsername(
        [FromBody] UsernameLoginRequest request,
        CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var username = request.Username.Trim();
        var user = await _userManager.FindByNameAsync(username);
        if (user is null)
            return Unauthorized(new { message = "اسم المستخدم غير موجود" });

        var roles = await _userManager.GetRolesAsync(user);
        var permissions = await _permissions.GetForUserIdAsync(user.Id, cancellationToken);
        var capabilities = permissions?.Capabilities ?? [];
        var (token, expiresAtUtc) = _jwtTokenService.CreateToken(user, roles, capabilities);

        return Ok(new LoginResponse
        {
            Token = token,
            ExpiresAtUtc = expiresAtUtc,
            User = new UserInfoDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                DisplayName = user.DisplayName,
            },
        });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !await _userManager.CheckPasswordAsync(user, request.Password))
            return Unauthorized(new { message = "بيانات الدخول غير صحيحة" });

        var roles = await _userManager.GetRolesAsync(user);
        var permissions = await _permissions.GetForUserIdAsync(user.Id, cancellationToken);
        var capabilities = permissions?.Capabilities ?? [];
        var (token, expiresAtUtc) = _jwtTokenService.CreateToken(user, roles, capabilities);

        return Ok(new LoginResponse
        {
            Token = token,
            ExpiresAtUtc = expiresAtUtc,
            User = new UserInfoDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                DisplayName = user.DisplayName,
            },
        });
    }

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

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return Unauthorized();

        PermissionsDto? permissions = null;
        if (includePermissions)
            permissions = await _permissions.GetForUserIdAsync(userId, cancellationToken);

        return Ok(new MeDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            Permissions = permissions,
        });
    }
}
