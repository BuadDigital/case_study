namespace RealEstateEval.Application.Abstractions;

public sealed record TokenSubject(string Id, string Email, string DisplayName);

public interface IJwtTokenService
{
    (string token, DateTime expiresAtUtc) CreateToken(
        TokenSubject subject,
        IEnumerable<string> roles,
        IEnumerable<string>? capabilities = null,
        string? prototypeRole = null,
        string? distributionAssigneeId = null,
        IEnumerable<string>? pages = null);
}
