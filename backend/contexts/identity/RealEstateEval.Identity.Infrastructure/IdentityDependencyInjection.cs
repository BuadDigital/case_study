using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Identity.Infrastructure.Persistence;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Application.Services;
using RealEstateEval.Infrastructure;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Sms;

namespace RealEstateEval.Identity.Infrastructure;

/// <summary>
/// Context-local registration for the Identity bounded context: auth sessions,
/// phone login, JWT issuance, user registration, and database-backed permission
/// resolution. The ASP.NET Identity stores, seed graph, and directory/label plumbing stay
/// global — other contexts construct them directly.
/// </summary>
public static class IdentityDependencyInjection
{
    /// <summary>
    /// ASP.NET Identity stores and Identity write/permission services. Callers must register
    /// <see cref="IdentityDbContext"/> first (via AddIdentityPersistence or a test InMemory
    /// registration).
    /// </summary>
    public static IServiceCollection AddIdentityApplicationServices(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IAuditLogWriter, AuditLogWriter>();
        // No IUserLabelLookup: Identity uses IdentityDbContext stores; label resolution that still
        // needs residual App lives only on hosts that call AddLegacyApplicationPersistence.
        services.AddIdentityStores();
        services.AddScoped<IIdentityDirectory, IdentityDirectory>();
        services.AddScoped<IUserLabelLookup>(sp => sp.GetRequiredService<IIdentityDirectory>());
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IAuthSessionService, AuthSessionService>();
        // Hosts that call AddSmsDelivery first get the provider; tests and tools get the log sender.
        services.TryAddScoped<ISmsSender, LoggingSmsSender>();
        services.AddScoped<ILoginOtpService, LoginOtpService>();
        // Staff registration is a use case in Identity.Application; the two adapters below are
        // the only places it reaches IdentityDbContext and UserManager (solid-scorecard finding 1).
        services.AddScoped<IStaffRegistrationRepository, StaffRegistrationRepository>();
        services.AddScoped<IStaffIdentityStore, StaffIdentityStore>();
        services.AddScoped<IUserRegistrationService, UserRegistrationService>();
        services.AddScoped<IPermissionService, PermissionService>();
        return services;
    }

    /// <summary>
    /// Full Identity host registration: stores, session/auth writes, and database-backed
    /// permission resolution. Only the Identity API (and Identity-focused tests/tools) should
    /// call this.
    /// </summary>
    public static IServiceCollection AddIdentityInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddIdentityPersistence(configuration, connectionString);
        services.AddOwnerCommandIdempotencyPersistence<IdentityDbContext>(configuration);
        services.AddRemoteAuditLogAppend(configuration);
        services.AddSmsDelivery(configuration);
        services.AddIdentityApplicationServices();
        return services;
    }

    /// <summary>
    /// SMS for the login code. With <c>Sms:OurSms:Enabled</c> (default) and an
    /// <c>Sms:OurSms:ApiKey</c> the OurSMS client is used and codes are checked strictly;
    /// otherwise the message goes to the log (see <see cref="LoggingSmsSender"/>) and a
    /// dev-login host accepts any well-formed code.
    /// </summary>
    public static IServiceCollection AddSmsDelivery(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<OurSmsOptions>()
            .Bind(configuration.GetSection(OurSmsOptions.SectionName))
            .Validate(
                o => !o.IsConfigured || !string.IsNullOrWhiteSpace(o.Sender),
                "Sms:OurSms:Sender is required when Sms:OurSms:ApiKey is set.")
            .Validate(
                o => Uri.TryCreate(o.BaseUrl, UriKind.Absolute, out _),
                "Sms:OurSms:BaseUrl must be an absolute URL.")
            .ValidateOnStart();
        var section = configuration.GetSection(OurSmsOptions.SectionName);
        var configured = section.GetValue("Enabled", true)
            && !string.IsNullOrWhiteSpace(section["ApiKey"]);
        if (configured)
        {
            services.AddHttpClient<ISmsSender, OurSmsSender>((sp, client) =>
                client.Timeout = TimeSpan.FromSeconds(Math.Clamp(
                    sp.GetRequiredService<IOptions<OurSmsOptions>>().Value.TimeoutSeconds, 3, 60)));
        }
        else
        {
            services.AddScoped<ISmsSender, LoggingSmsSender>();
        }
        return services;
    }
 /// <summary>Identity write context. physical move: lives beside <see cref="IdentityDbContext"/>.</summary>
    public static IServiceCollection AddIdentityPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<IdentityDbContext>(configuration);
    }

 /// <summary>
 /// ASP.NET Identity stores against <see cref="IdentityDbContext"/>. Used by the Identity
 /// host and by Development seeding hosts that still need <see cref="UserManager{TUser}"/>.
 /// </summary>
    public static IServiceCollection AddIdentityStores(this IServiceCollection services)
    {
        services
            .AddIdentity<ApplicationUser, IdentityRole>(options =>
            {
                options.User.RequireUniqueEmail = true;
                // Lockout is the soft-disable mechanism (LockOutIndefinitelyAsync); there is no credential to fail.
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddEntityFrameworkStores<IdentityDbContext>()
            .AddDefaultTokenProviders();

        // AddIdentity() makes the Identity application cookie the default
        // authenticate/challenge scheme, which sends API callers to /Account/Login —
        // on the Identity host this 401'd every [Authorize] endpoint (incl.
        // /api/permissions, breaking the shell role chip). The APIs are JWT-only,
        // so re-assert bearer; this Configure runs after Identity's and wins.
        services.Configure<AuthenticationOptions>(options =>
        {
            options.DefaultAuthenticateScheme = "Bearer";
            options.DefaultChallengeScheme = "Bearer";
        });

        services.Configure<DataProtectionTokenProviderOptions>(options =>
            options.TokenLifespan = TimeSpan.FromHours(24));

        return services;
    }

}
