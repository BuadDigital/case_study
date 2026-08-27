using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using RealEstateEval.Identity.Application.Abstractions;

namespace RealEstateEval.Identity.Infrastructure.Services;

public class JwtTokenService : IJwtTokenService
{
 /// <summary>Access tokens stay short because capabilities are baked into them.</summary>
    public const int DefaultAccessTokenMinutes = 15;
    private const int MaxAccessTokenMinutes = 480;

    private readonly IConfiguration _configuration;
    private readonly TimeProvider _time;

    public JwtTokenService(IConfiguration configuration,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _configuration = configuration;
    }

    public (string token, DateTime expiresAtUtc) CreateToken(
        TokenSubject subject,
        IEnumerable<string> roles,
        IEnumerable<string>? capabilities = null,
        string? prototypeRole = null,
        string? distributionAssigneeId = null,
        IEnumerable<string>? pages = null,
        string? department = null)
    {
        var issuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer missing");
        var audience = _configuration["Jwt:Audience"] ?? throw new InvalidOperationException("Jwt:Audience missing");
        var signingKey = _configuration["Jwt:SigningKey"] ?? throw new InvalidOperationException("Jwt:SigningKey missing");

        var lifetimeMinutes = Math.Clamp(
            _configuration.GetValue("Jwt:AccessTokenMinutes", DefaultAccessTokenMinutes),
            1,
            MaxAccessTokenMinutes);
        var expiresAtUtc = _time.UtcNow().AddMinutes(lifetimeMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, subject.Id),
            new(JwtRegisteredClaimNames.Email, subject.Email),
            new("displayName", subject.DisplayName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        claims.AddRange(roles.Select(r => new Claim("role", r)));
        if (capabilities is not null)
        {
            claims.AddRange(capabilities.Select(c => new Claim(PlatformCapabilities.ClaimType, c)));
        }

        if (!string.IsNullOrWhiteSpace(prototypeRole))
            claims.Add(new Claim("prototypeRole", prototypeRole.Trim()));
        if (!string.IsNullOrWhiteSpace(distributionAssigneeId))
            claims.Add(new Claim("distributionAssigneeId", distributionAssigneeId.Trim()));
        if (!string.IsNullOrWhiteSpace(department))
            claims.Add(new Claim("department", department.Trim()));
        if (pages is not null)
            claims.AddRange(pages.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => new Claim("page", p)));

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
