using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Identity.Application.Abstractions;

public interface IPasswordAuthenticationService
{
    Task<LoginResponseDto?> AuthenticateAsync(
        string usernameOrEmail,
        string password,
        CancellationToken cancellationToken = default);
}
