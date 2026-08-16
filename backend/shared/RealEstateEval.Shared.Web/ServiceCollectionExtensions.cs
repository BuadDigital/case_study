using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Shared.Web;

public static class AuthorizationExtensions
{
    public static IServiceCollection AddRealEstateEvalCapabilityAuthorization(
        this IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationHandler, CapabilityAuthorizationHandler>();

        services.AddAuthorization(options =>
        {
            foreach (var capability in PlatformCapabilities.All)
            {
                options.AddPolicy(
                    CapabilityPolicyNames.For(capability),
                    policy => policy.AddRequirements(new CapabilityRequirement(capability)));
            }

            // Back-compat with existing controllers.
            options.AddPolicy(
                "CanManageUsers",
                policy => policy.AddRequirements(
                    new CapabilityRequirement(PlatformCapabilities.ManageUsers)));

            options.AddPolicy(
                CapabilityPolicyNames.RaiseFailures,
                policy => policy.RequireAssertion(ctx =>
                    ctx.User.HasClaim(
                        CapabilityAuthorizationHandler.ClaimType,
                        PlatformCapabilities.ManageFailures)
                    || ctx.User.HasClaim(
                        CapabilityAuthorizationHandler.ClaimType,
                        PlatformCapabilities.SubmitPartyWork)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadFinancialData,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageFinancial,
                    PlatformCapabilities.ManageWorkOrders)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadManagementReports,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageWorkOrders)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadKeyData,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageOperations,
                    PlatformCapabilities.ManageFinancial)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadValuationQueue,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageValuationRequests,
                    PlatformCapabilities.SubmitValuationReport)));

            // 11هـ2 feed #1 — الميداني يلتقط العروض والصفقات أثناء المعاينة, so the
            // party-work capability also writes to the shared bank.
            options.AddPolicy(
                CapabilityPolicyNames.WriteComparableBank,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageValuationRequests,
                    PlatformCapabilities.SubmitValuationReport,
                    PlatformCapabilities.SubmitPartyWork)));

            options.AddPolicy(
                CapabilityPolicyNames.ListDistributionAssignees,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageWorkOrders,
                    PlatformCapabilities.ManageOperations)));

            options.AddPolicy(
                CapabilityPolicyNames.ManagePartyFeePricing,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageSystemConfig,
                    PlatformCapabilities.ManageOperations,
                    PlatformCapabilities.ManageWorkOrders)));
        });

        return services;
    }

    private static bool HasAnyCapability(
        AuthorizationHandlerContext context,
        params string[] capabilities)
    {
        return Array.Exists(
            capabilities,
            capability => context.User.HasClaim(
                CapabilityAuthorizationHandler.ClaimType,
                capability));
    }
}

public static class ServiceCollectionExtensions
{
    private const int MinimumJwtSigningKeyLength = 64;

    public static IServiceCollection AddRealEstateEvalJwt(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var jwtIssuer = RequireJwtValue(configuration, "Issuer");
        var jwtAudience = RequireJwtValue(configuration, "Audience");
        var jwtSigningKey = RequireJwtValue(configuration, "SigningKey");

        if (!environment.IsDevelopment())
        {
            if (jwtSigningKey.Length < MinimumJwtSigningKeyLength)
            {
                throw new InvalidOperationException(
                    $"Jwt:SigningKey must be at least {MinimumJwtSigningKeyLength} characters outside Development.");
            }

            if (jwtSigningKey.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase)
                || jwtSigningKey.Contains("DEV_ONLY", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "Jwt:SigningKey contains a known placeholder and cannot be used outside Development.");
            }
        }

        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwtIssuer,
                    ValidAudience = jwtAudience,
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtSigningKey)),
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = JwtRegisteredClaimNames.Sub,
                    RoleClaimType = "role",
                };
            });

        services.AddRealEstateEvalCapabilityAuthorization();

        return services;
    }

    private static string RequireJwtValue(IConfiguration configuration, string name)
    {
        var value = configuration[$"Jwt:{name}"];
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Jwt:{name} is required.");
        }

        return value;
    }

    public static IServiceCollection AddRealEstateEvalCors(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var corsOptions = RealEstateEvalCorsOptions.FromConfiguration(configuration, environment);

        services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                if (environment.IsDevelopment())
                {
                    // Teammates browse the dev shell over the LAN, so any host on the Next.js
                    // ports is allowed on top of whatever Cors:AllowedOrigins lists.
                    var configured = corsOptions.AllowedOrigins.ToHashSet(
                        StringComparer.OrdinalIgnoreCase);

                    policy.SetIsOriginAllowed(origin =>
                        configured.Contains(origin) || IsDevelopmentShellOrigin(origin));
                }
                else
                {
                    // Empty list means "no cross-origin browser access", which is correct when
                    // the frontend proxies /api through its own origin.
                    policy.WithOrigins([.. corsOptions.AllowedOrigins]);
                }

                policy.AllowAnyHeader().AllowAnyMethod();

                if (corsOptions.AllowCredentials)
                    policy.AllowCredentials();
            });
        });

        if (corsOptions.WarnOnMissingOrigins)
            services.AddHostedService<MissingCorsOriginsAnnouncer>();

        return services;
    }

    private static bool IsDevelopmentShellOrigin(string origin) =>
        !string.IsNullOrEmpty(origin)
        && Uri.TryCreate(origin, UriKind.Absolute, out var uri)
        && uri.Port is 3000 or 3001;

    public static string RequireConnectionString(
        IConfiguration configuration,
        string? serviceName = null,
        string envVarName = "REAL_ESTATE_EVAL_PG_CONNECTION_STRING")
    {
        string? connectionString = null;

        if (!string.IsNullOrWhiteSpace(serviceName))
        {
            var serviceEnv = $"REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{serviceName.ToUpperInvariant()}";
            connectionString =
                Environment.GetEnvironmentVariable(serviceEnv)
                ?? configuration.GetConnectionString(serviceName);
        }

        connectionString ??=
            Environment.GetEnvironmentVariable(envVarName)
            ?? configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            var hint = string.IsNullOrWhiteSpace(serviceName)
                ? $"Set {envVarName}, or ConnectionStrings:DefaultConnection."
                : $"Set REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{serviceName!.ToUpperInvariant()}, ConnectionStrings:{serviceName}, {envVarName}, or ConnectionStrings:DefaultConnection.";
            throw new InvalidOperationException($"Database connection missing. {hint}");
        }

        return connectionString;
    }
}
