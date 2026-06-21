using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string TestScheme = "IntegrationTest";
    public const string AuthOnlyToken = "auth-only";
    public const string FinancialToken = "financial-user";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header) ||
            !header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var token = header["Bearer ".Length..].Trim();
        if (token is not (AuthOnlyToken or FinancialToken))
            return Task.FromResult(AuthenticateResult.Fail("Unknown test token"));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "integration-test-user"),
            new(PlatformCapabilities.ClaimType, PlatformCapabilities.Authenticated),
        };

        if (token == FinancialToken)
            claims.Add(new Claim(PlatformCapabilities.ClaimType, PlatformCapabilities.ManageFinancial));

        var identity = new ClaimsIdentity(claims, TestScheme);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), TestScheme);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
