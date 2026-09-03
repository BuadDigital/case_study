using System.Reflection;
using Microsoft.AspNetCore.Builder;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Per-process composition root. The shared <c>ServiceProgram.cs</c> entry point discovers
/// exactly one implementation on the assembly that compiled that file (the API host).
/// WebApplicationFactory invokes Main through testhost, so <see cref="Assembly.GetEntryAssembly"/>
/// is the test host and cannot be used.
/// </summary>
public interface IRealEstateEvalServiceModule
{
    string ServiceName { get; }
    string OpenApiTitle { get; }

    /// <summary>
    /// <see cref="ServiceDatabaseNames"/> key, or <c>null</c> when the host has no database.
    /// </summary>
    string? ConnectionStringKey { get; }

    void ConfigureHostOptions(RealEstateEvalApiHostOptions options) { }

    void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString);

    Task ConfigureAppAsync(WebApplication app, string? connectionString);
}

public static class RealEstateEvalServiceModule
{
    public static IRealEstateEvalServiceModule ResolveFrom(Assembly assembly)
    {
        var types = assembly.GetTypes()
            .Where(type => type is { IsClass: true, IsAbstract: false }
                && typeof(IRealEstateEvalServiceModule).IsAssignableFrom(type))
            .ToArray();

        if (types.Length != 1)
        {
            throw new InvalidOperationException(
                $"Expected exactly one {nameof(IRealEstateEvalServiceModule)} in {assembly.GetName().Name}, found {types.Length}.");
        }

        return (IRealEstateEvalServiceModule)Activator.CreateInstance(types[0])!;
    }

}
