using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// JWT for owner-to-owner calls that run outside an HTTP request
/// (hosted sweeps). Uses the same Jwt:Issuer/Audience/SigningKey as user tokens.
/// </summary>
internal sealed class UpstreamServiceBearer
{
    /// <summary>Set at host start so static UpstreamJson can fall back without HttpContext.</summary>
    internal static UpstreamServiceBearer? Ambient { get; set; }

    private readonly IConfiguration _configuration;
    private readonly TimeProvider _time;
    private readonly object _gate = new();
    private string? _cachedHeader;
    private DateTimeOffset _expiresAtUtc;

    public UpstreamServiceBearer(IConfiguration configuration, TimeProvider? time = null)
    {
        _configuration = configuration;
        _time = time ?? TimeProvider.System;
    }

    /// <summary>Full Authorization header value, e.g. <c>Bearer …</c>.</summary>
    public string? GetAuthorizationHeader()
    {
        var now = _time.GetUtcNow();
        lock (_gate)
        {
            if (_cachedHeader is not null && now < _expiresAtUtc - TimeSpan.FromMinutes(2))
                return _cachedHeader;

            var issuer = _configuration["Jwt:Issuer"];
            var audience = _configuration["Jwt:Audience"];
            var signingKey = _configuration["Jwt:SigningKey"];
            if (string.IsNullOrWhiteSpace(issuer)
                || string.IsNullOrWhiteSpace(audience)
                || string.IsNullOrWhiteSpace(signingKey))
            {
                return null;
            }

            var lifetimeMinutes = Math.Clamp(
                _configuration.GetValue("Jwt:UpstreamServiceTokenMinutes", 60),
                5,
                480);
            var expires = now.AddMinutes(lifetimeMinutes);
            var claims = new Claim[]
            {
                new(JwtRegisteredClaimNames.Sub, "ree-upstream-service"),
                new("displayName", "REE Upstream Service"),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new("tokenUse", "upstream-service"),
            };
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
            var jwt = new JwtSecurityToken(
                issuer,
                audience,
                claims,
                notBefore: now.UtcDateTime,
                expires: expires.UtcDateTime,
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            var token = new JwtSecurityTokenHandler().WriteToken(jwt);
            _cachedHeader = $"Bearer {token}";
            _expiresAtUtc = expires;
            return _cachedHeader;
        }
    }
}

/// <summary>Publishes <see cref="UpstreamServiceBearer.Ambient"/> before other hosted sweeps run.</summary>
internal sealed class UpstreamServiceBearerWarmupHostedService : IHostedService
{
    public UpstreamServiceBearerWarmupHostedService(UpstreamServiceBearer bearer)
    {
        UpstreamServiceBearer.Ambient = bearer;
    }

    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
