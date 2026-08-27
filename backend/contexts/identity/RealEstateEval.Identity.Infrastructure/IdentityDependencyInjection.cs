using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Infrastructure;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;

namespace RealEstateEval.Identity.Infrastructure;

/// <summary>
/// Context-local registration for the Identity bounded context (A8): auth sessions, password
/// login, JWT issuance, user registration, and database-backed permission resolution. The
/// ASP.NET Identity stores, seed graph, and directory/label plumbing stay global — other
/// contexts construct them directly.
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
        services.AddScoped<IPasswordAuthenticationService, PasswordAuthenticationService>();
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
        services.AddRemoteAuditLogAppend(configuration);
        services.AddIdentityApplicationServices();
        return services;
    }
 /// <summary>Identity write context. A8 physical move: lives beside <see cref="IdentityDbContext"/>.</summary>
    public static IServiceCollection AddIdentityPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<IdentityDbContext>(configuration, connectionString);
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
                options.Password.RequiredLength = 12;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
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
