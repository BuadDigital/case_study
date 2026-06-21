using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface IJwtTokenService
{
    (string token, DateTime expiresAtUtc) CreateToken(
        ApplicationUser user,
        IEnumerable<string> roles,
        IEnumerable<string>? capabilities = null);
}
