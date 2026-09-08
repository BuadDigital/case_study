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

 // The property's «تقييم العقار» tab: case staff (manage-work-orders) read the report of a
 // transaction they run; the queue itself and every write stay on the two policies above.
            options.AddPolicy(
                CapabilityPolicyNames.ReadValuationReport,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageValuationRequests,
                    PlatformCapabilities.SubmitValuationReport,
                    PlatformCapabilities.ManageWorkOrders)));

 // 11H-2 feed — field inspector captures listings and deals during inspection, so the
 // party-work capability also writes to the shared bank.
            options.AddPolicy(
                CapabilityPolicyNames.WriteComparableBank,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageValuationRequests,
                    PlatformCapabilities.SubmitValuationReport,
                    PlatformCapabilities.SubmitPartyWork,
                    PlatformCapabilities.ManageWorkOrders)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadComparableBank,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageValuationRequests,
                    PlatformCapabilities.SubmitValuationReport,
                    PlatformCapabilities.SubmitPartyWork,
                    PlatformCapabilities.ManageWorkOrders)));

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

            options.AddPolicy(
                CapabilityPolicyNames.ReadCaseStudyWorkspace,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageWorkOrders,
                    PlatformCapabilities.SubmitPartyWork)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadAttachments,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageAttachments,
                    PlatformCapabilities.ManageWorkOrders,
                    PlatformCapabilities.SubmitPartyWork,
                    PlatformCapabilities.ManageValuationRequests,
                    PlatformCapabilities.SubmitValuationReport,
                    PlatformCapabilities.ManageFinancial,
                    PlatformCapabilities.ManageOperations)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadIdentityDirectory,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageWorkOrders,
                    PlatformCapabilities.ManageOperations,
                    PlatformCapabilities.ManageFinancial,
                    PlatformCapabilities.ManageValuationRequests,
                    PlatformCapabilities.SubmitValuationReport,
                    PlatformCapabilities.SubmitPartyWork)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadPartyPayables,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageFinancial,
                    PlatformCapabilities.ManageOperations,
                    PlatformCapabilities.SubmitPartyWork,
                    PlatformCapabilities.ManageWorkOrders)));

            options.AddPolicy(
                CapabilityPolicyNames.ReadInspectionContext,
                policy => policy.RequireAssertion(ctx => HasAnyCapability(
                    ctx,
                    PlatformCapabilities.ManageWorkOrders,
                    PlatformCapabilities.SubmitPartyWork,
                    PlatformCapabilities.SubmitValuationReport,
                    PlatformCapabilities.ManageValuationRequests)));
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
        var previousSigningKey = configuration["Jwt:PreviousSigningKey"]?.Trim();

        if (!environment.IsDevelopment())
        {
            ValidateProductionSigningKey(jwtSigningKey, "Jwt:SigningKey");
            if (!string.IsNullOrEmpty(previousSigningKey))
                ValidateProductionSigningKey(previousSigningKey, "Jwt:PreviousSigningKey");
        }

        var signingKeys = new List<SecurityKey>
        {
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
        };
        if (!string.IsNullOrEmpty(previousSigningKey)
            && !string.Equals(previousSigningKey, jwtSigningKey, StringComparison.Ordinal))
        {
            signingKeys.Add(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(previousSigningKey)));
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
                    // Current key first; optional previous key keeps access tokens valid
                    // during a rotation window (see docs/ops/jwt-signing-key-rotation.md).
                    IssuerSigningKeys = signingKeys,
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = JwtRegisteredClaimNames.Sub,
                    RoleClaimType = "role",
                };
            });

        services.AddRealEstateEvalCapabilityAuthorization();

        return services;
    }

    private static void ValidateProductionSigningKey(string key, string settingName)
    {
        if (key.Length < MinimumJwtSigningKeyLength)
        {
            throw new InvalidOperationException(
                $"{settingName} must be at least {MinimumJwtSigningKeyLength} characters outside Development.");
        }

        if (key.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase)
            || key.Contains("DEV_ONLY", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"{settingName} contains a known placeholder and cannot be used outside Development.");
        }
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
        string envVarName = "REAL_ESTATE_EVAL_PG_CONNECTION_STRING",
        IHostEnvironment? environment = null)
    {
        if (string.IsNullOrWhiteSpace(serviceName))
        {
            throw new InvalidOperationException(
                "A service-scoped database name is required. The leftover shared connection is not used.");
        }

        var serviceEnv = $"REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{serviceName.ToUpperInvariant()}";
        var fromEnv = Environment.GetEnvironmentVariable(serviceEnv);
        if (!string.IsNullOrWhiteSpace(fromEnv))
            return fromEnv;

        var fromConfig = configuration.GetConnectionString(serviceName);
        if (!string.IsNullOrWhiteSpace(fromConfig))
            return fromConfig;

        throw new InvalidOperationException(
            $"Database connection missing. Set {serviceEnv} or ConnectionStrings:{serviceName}.");
    }
}
