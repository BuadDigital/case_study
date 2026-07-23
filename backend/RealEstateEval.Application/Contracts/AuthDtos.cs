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

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
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
