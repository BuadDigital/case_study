using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

/// <summary>Login — mobile (preferred) or username.</summary>
public class UsernameLoginRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(120)]
    public string Username { get; set; } = string.Empty;
}

/// <summary>Step 1 of mobile login: send the code.</summary>
public class OtpRequestRequest
{
    [Required]
    [MaxLength(20)]
    public string Mobile { get; set; } = string.Empty;
}

/// <summary>Step 2 of mobile login: exchange the code for a session.</summary>
public class OtpVerifyRequest
{
    [Required]
    [MaxLength(20)]
    public string Mobile { get; set; } = string.Empty;

    [Required]
    [MaxLength(12)]
    public string Code { get; set; } = string.Empty;
}

public class OtpRequestResponseDto
{
    /// <summary>Seconds before another code may be requested for this mobile.</summary>
    public int RetryAfterSeconds { get; set; }
    public int ExpiresInSeconds { get; set; }
    /// <summary><c>sms</c> when a provider carried the code, <c>dev</c> when it only went to the log.</summary>
    public string Delivery { get; set; } = string.Empty;
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
    public string DisplayName { get; set; } = string.Empty;
    public string? JobTitle { get; set; }
}

