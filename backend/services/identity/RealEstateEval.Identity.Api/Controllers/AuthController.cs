using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Identity.Application.Abstractions;

namespace RealEstateEval.Identity.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthSessionService _sessions;
    private readonly IPermissionService _permissions;
    private readonly IUserRegistrationService _users;
    private readonly ILoginOtpService _otp;
    private readonly IConfiguration _configuration;

    public AuthController(
        IAuthSessionService sessions,
        IPermissionService permissions,
        IUserRegistrationService users,
        ILoginOtpService otp,
        IConfiguration configuration)
    {
        _sessions = sessions;
        _permissions = permissions;
        _users = users;
        _otp = otp;
        _configuration = configuration;
    }

    /// <summary>
    /// Login by mobile (preferred) or username. Gated by Auth:EnableDevLogin.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Login(
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
            ? this.UnauthorizedProblem("تعذّر تسجيل الدخول")
            : Ok(session);
    }


    /// <summary>
    /// Mobile login, step 1: sends a one-time code by SMS. Answers the same for a mobile
    /// without an account, so the endpoint does not reveal who is registered.
    /// </summary>
    [HttpPost("otp/request")]
    [AllowAnonymous]
    public async Task<ActionResult<OtpRequestResponseDto>> RequestOtp(
        [FromBody] OtpRequestRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var outcome = await _otp.RequestAsync(request.Mobile, cancellationToken);
        var dto = new OtpRequestResponseDto
        {
            RetryAfterSeconds = outcome.RetryAfterSeconds,
            ExpiresInSeconds = outcome.ExpiresInSeconds,
            Delivery = outcome.Delivery,
        };
        return outcome.Status switch
        {
            OtpRequestStatus.Sent => Ok(dto),
            OtpRequestStatus.Throttled => Problem(
                    statusCode: StatusCodes.Status429TooManyRequests,
                    title: "Too Many Requests",
                    detail: $"أُرسل رمز قبل قليل — أعد المحاولة بعد {outcome.RetryAfterSeconds} ثانية.")
                .WithProblemExtension(ApiProblemExtensions.LegacyMessageMember,
                    $"أُرسل رمز قبل قليل — أعد المحاولة بعد {outcome.RetryAfterSeconds} ثانية.")
                .WithProblemExtension("retryAfterSeconds", outcome.RetryAfterSeconds),
            _ => Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "SMS Unavailable",
                    detail: "تعذّر إرسال رمز التحقق الآن، حاول بعد قليل.")
                .WithProblemExtension(ApiProblemExtensions.LegacyMessageMember,
                    "تعذّر إرسال رمز التحقق الآن، حاول بعد قليل."),
        };
    }

    /// <summary>Mobile login, step 2: the code for a session. One message for every failure.</summary>
    [HttpPost("otp/verify")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> VerifyOtp(
        [FromBody] OtpVerifyRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var outcome = await _otp.VerifyAsync(request.Mobile, request.Code, cancellationToken);
        return outcome.Status == OtpVerifyStatus.Ok && outcome.Session is not null
            ? Ok(outcome.Session)
            : this.UnauthorizedProblem("الرمز غير صحيح أو انتهت صلاحيته.");
    }

    /// <summary>
    /// Exchanges a refresh token for a fresh access token, re-reading roles and
    /// capabilities so permission changes apply without a new login.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Refresh(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var session = await _sessions.RefreshAsync(request.RefreshToken, cancellationToken);
        if (session is not null)
            return Ok(session);

        // A disabled account gets a distinct code so the device wipes its offline store
        // on first contact (spec §3.4); a plain expiry must keep unsynced field work.
        if (await _sessions.IsDisabledAccountTokenAsync(request.RefreshToken, cancellationToken))
        {
            return this.UnauthorizedProblem("تم تعطيل الحساب")
                .WithProblemExtension("code", AccountDisabledCode);
        }

        return this.UnauthorizedProblem("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
    }

    /// <summary>Problem <c>code</c> for a refresh refused because the account is disabled.</summary>
    public const string AccountDisabledCode = "account-disabled";

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
        _configuration.GetValue("Auth:EnableDevLogin", false);

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeDto>> Me(
        [FromQuery] bool includePermissions = true,
        CancellationToken cancellationToken = default)
    {
        var userId = ActorClaims.TryId(User);
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
        var userId = ActorClaims.TryId(User);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var profile = await _users.GetByUserIdAsync(userId, cancellationToken);
        return profile is null ? Unauthorized() : Ok(profile);
    }
}
