using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace RealEstateEval.Shared.Web;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRealEstateEvalJwt(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var jwtIssuer = configuration["Jwt:Issuer"];
        var jwtAudience = configuration["Jwt:Audience"];
        var jwtSigningKey = configuration["Jwt:SigningKey"];

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
                        Encoding.UTF8.GetBytes(jwtSigningKey ?? "")),
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = JwtRegisteredClaimNames.Sub,
                    RoleClaimType = "role",
                };
            });

        services.AddAuthorization(options =>
        {
            options.AddPolicy("CanManageUsers", policy =>
                policy.RequireAuthenticatedUser());
        });

        return services;
    }

    public static IServiceCollection AddRealEstateEvalCors(
        this IServiceCollection services,
        IHostEnvironment environment)
    {
        services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                if (environment.IsDevelopment())
                {
                    policy
                        .SetIsOriginAllowed(origin =>
                        {
                            if (string.IsNullOrEmpty(origin) ||
                                !Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                                return false;
                            return uri.Port is 3000 or 3001;
                        })
                        .AllowAnyHeader()
                        .AllowAnyMethod();
                }
                else
                {
                    policy.WithOrigins("http://localhost:3000")
                        .AllowAnyHeader()
                        .AllowAnyMethod();
                }
            });
        });

        return services;
    }

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
