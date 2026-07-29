using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Domain;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace RealEstateEval.Infrastructure.Services;

public class JwtTokenService : IJwtTokenService
{
    /// <summary>Access tokens stay short because capabilities are baked into them.</summary>
    public const int DefaultAccessTokenMinutes = 15;
    private const int MaxAccessTokenMinutes = 480;

    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public (string token, DateTime expiresAtUtc) CreateToken(
        ApplicationUser user,
        IEnumerable<string> roles,
        IEnumerable<string>? capabilities = null)
    {
        var issuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer missing");
        var audience = _configuration["Jwt:Audience"] ?? throw new InvalidOperationException("Jwt:Audience missing");
        var signingKey = _configuration["Jwt:SigningKey"] ?? throw new InvalidOperationException("Jwt:SigningKey missing");

        var lifetimeMinutes = Math.Clamp(
            _configuration.GetValue("Jwt:AccessTokenMinutes", DefaultAccessTokenMinutes),
            1,
            MaxAccessTokenMinutes);
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(lifetimeMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new("displayName", user.DisplayName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        claims.AddRange(roles.Select(r => new Claim("role", r)));
        if (capabilities is not null)
        {
            claims.AddRange(capabilities.Select(c => new Claim(PlatformCapabilities.ClaimType, c)));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: expiresAtUtc,
            signingCredentials: creds);

        var token = new JwtSecurityTokenHandler().WriteToken(jwt);
        return (token, expiresAtUtc);
    }
}
