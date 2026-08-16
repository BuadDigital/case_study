using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// Stands in for JWT bearer authentication so tests can assert the authorization policies
/// themselves. Every accepted token is authenticated; capabilities come from the token value, so
/// a test can describe exactly the actor it needs with <see cref="TokenFor"/>.
/// </summary>
public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string TestScheme = "IntegrationTest";
    public const string AuthOnlyToken = "auth-only";
    public static readonly string FinancialToken = TokenFor(PlatformCapabilities.ManageFinancial);
    public static readonly string AttachmentsToken =
        TokenFor(PlatformCapabilities.ManageAttachments);

    private const string CapabilityTokenPrefix = "caps:";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

 /// <summary>Builds a bearer token for an actor holding exactly <paramref name="capabilities"/>.</summary>
    public static string TokenFor(params string[] capabilities) =>
        CapabilityTokenPrefix + string.Join(',', capabilities);

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header) ||
            !header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var token = header["Bearer ".Length..].Trim();
        if (!TryReadCapabilities(token, out var capabilities))
            return Task.FromResult(AuthenticateResult.Fail("Unknown test token"));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "integration-test-user"),
            new(PlatformCapabilities.ClaimType, PlatformCapabilities.Authenticated),
        };

        foreach (var capability in capabilities)
            claims.Add(new Claim(PlatformCapabilities.ClaimType, capability));

        var identity = new ClaimsIdentity(claims, TestScheme);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), TestScheme);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }

    private static bool TryReadCapabilities(string token, out string[] capabilities)
    {
        if (token == AuthOnlyToken)
        {
            capabilities = [];
            return true;
        }

        if (token.StartsWith(CapabilityTokenPrefix, StringComparison.Ordinal))
        {
            capabilities = token[CapabilityTokenPrefix.Length..]
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return true;
        }

        capabilities = [];
        return false;
    }
}
