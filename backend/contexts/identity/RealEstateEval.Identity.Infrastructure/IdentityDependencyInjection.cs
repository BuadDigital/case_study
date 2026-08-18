using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Infrastructure;

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
}
