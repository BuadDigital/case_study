using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

/// <summary>Prototype login — username only, no password check.</summary>
public class UsernameLoginRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(64)]
    public string Username { get; set; } = string.Empty;
}

public class PasswordLoginRequest
{
 /// <summary>Mobile (preferred), email, or legacy username.</summary>
    [Required]
    [MinLength(2)]
    [MaxLength(120)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [MaxLength(256)]
    public string Password { get; set; } = string.Empty;
}

public class RefreshTokenRequest
{
    [Required]
    [MaxLength(256)]
    public string RefreshToken { get; set; } = string.Empty;
}

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
 /// <summary>Opaque rotating token for <c>POST /api/auth/refresh</c>.</summary>
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime RefreshTokenExpiresAtUtc { get; set; }
    public UserInfoDto User { get; set; } = null!;
}

public class UserInfoDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

public class DevLoginUserDto
{
    public string Username { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}
