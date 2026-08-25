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
    /// <summary>Field inspector who uploaded attachments on prop-1 (user id owner-1).</summary>
    public const string InspectorOwnerToken = "actor:owner-1:field-inspector";
    /// <summary>Another field inspector who did not upload prop-1 attachments.</summary>
    public const string InspectorOtherToken = "actor:other:field-inspector";
    /// <summary>Field inspector with no uploads on prop-1.</summary>
    public const string InspectorStrangerToken = "actor:stranger:field-inspector";
    public static readonly string FinancialToken = TokenFor(PlatformCapabilities.ManageFinancial);
    public static readonly string AttachmentsToken =
        TokenFor(PlatformCapabilities.ManageAttachments);

    private const string CapabilityTokenPrefix = "caps:";
    private const string ActorTokenPrefix = "actor:";

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

        var userId = "integration-test-user";
        string? prototypeRole = null;
        if (TryReadActorToken(token, out var actorUserId, out var actorRole))
        {
            userId = actorUserId;
            prototypeRole = actorRole;
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(PlatformCapabilities.ClaimType, PlatformCapabilities.Authenticated),
        };

        if (!string.IsNullOrWhiteSpace(prototypeRole))
            claims.Add(new Claim("prototypeRole", prototypeRole));

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

        if (token.StartsWith(ActorTokenPrefix, StringComparison.Ordinal))
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

    private static bool TryReadActorToken(
        string token,
        out string userId,
        out string? prototypeRole)
    {
        userId = "integration-test-user";
        prototypeRole = null;
        if (!token.StartsWith(ActorTokenPrefix, StringComparison.Ordinal))
            return false;

        var parts = token.Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length < 3)
            return false;

        userId = parts[1];
        prototypeRole = parts[2];
        return true;
    }
}
