using System.Text.Json;
using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Browsers reach every service through the gateway, so a controller whose <c>api/...</c> prefix has no
/// gateway route answers 404 to the frontend while its own tests (which skip the gateway) stay green.
/// Every public controller prefix must be matched by a route in the gateway's <c>appsettings.json</c> that
/// leads to the service owning the controller; prefixes that are meant to be called service-to-service only are
/// listed explicitly below. Case Study needs no route of its own: it is the gateway's catch-all cluster.
/// </summary>
public class GatewayRouteCoverageTests
{
    private static readonly Regex ClassRoute = new(
        @"\[Route\(\s*""(?<template>[^""]+)""\s*\)\]\s*(?:\[[^\]]*\]\s*)*public\s+(?:sealed\s+)?class\s+\w+Controller",
        RegexOptions.Compiled | RegexOptions.Singleline);

    /// <summary>
    /// Called by other services over their upstream base URLs (never through the gateway). Adding a prefix here is
    /// a deliberate statement that no browser calls it.
    /// </summary>
    private static readonly HashSet<string> ServiceToServicePrefixes = new(StringComparer.Ordinal)
    {
        "api/failure-dispatch",
        "api/financial-dispatch",
        "api/identity",
        "api/key-envelope-dispatch",
        "api/operations-task-dispatch",
        "api/valuation-request-dispatch",
    };

    /// <summary>The cluster that receives everything no other route claims.</summary>
    private const string CatchAllService = "case-study";

    [Fact]
    public void Every_controller_prefix_is_reachable_through_the_gateway()
    {
        var routes = GatewayRoutes();
        var uncovered = new List<string>();

        foreach (var file in RepoPaths.CSharpFiles(RepoPaths.Combine("backend", "services")))
        {
            var relative = RepoPaths.Relative(file);
            if (!relative.Contains("/Controllers/", StringComparison.OrdinalIgnoreCase)) continue;

            // backend/services/<service>/...
            var service = relative.Split('/')[2];
            if (service == CatchAllService) continue;

            foreach (Match match in ClassRoute.Matches(File.ReadAllText(file)))
            {
                var prefix = StaticPrefix(match.Groups["template"].Value);
                if (prefix is null || ServiceToServicePrefixes.Contains(prefix)) continue;
                if (!routes.Any(route => route.Cluster == service && Covers(route.Path, prefix)))
                    uncovered.Add($"{prefix}  -> cluster '{service}'  ({relative})");
            }
        }

        Assert.True(
            uncovered.Count == 0,
            "No gateway route (backend/gateway/RealEstateEval.Gateway/appsettings.json) leads these controller prefixes to their service:\n  "
            + string.Join("\n  ", uncovered.Distinct().OrderBy(x => x, StringComparer.Ordinal)));
    }

    /// <summary>The leading static segments of a route template: <c>api/valuation-requests/{id}/x</c> → <c>api/valuation-requests</c>.</summary>
    private static string? StaticPrefix(string template)
    {
        var segments = template.TrimStart('~', '/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .TakeWhile(segment => !segment.StartsWith('{'))
            .ToList();
        // Token templates ([controller]) are resolved by the framework; the explicit routes in the gateway name them.
        if (segments.Any(segment => segment.Contains('['))) return null;
        return segments.Count >= 2 && segments[0] == "api" ? string.Join('/', segments.Take(2)) : null;
    }

    /// <summary>A gateway route covers a prefix when it is that prefix itself or a catch-all below it.</summary>
    private static bool Covers(string gatewayPath, string prefix)
    {
        var path = gatewayPath.Trim('/');
        return path == prefix || path.StartsWith(prefix + "/", StringComparison.Ordinal);
    }

    private static IReadOnlyList<(string Path, string Cluster)> GatewayRoutes()
    {
        var file = RepoPaths.Combine("backend", "gateway", "RealEstateEval.Gateway", "appsettings.json");
        using var document = JsonDocument.Parse(File.ReadAllText(file));
        var routes = document.RootElement.GetProperty("ReverseProxy").GetProperty("Routes");
        return routes.EnumerateObject()
            .Select(route => (
                Path: route.Value.GetProperty("Match").GetProperty("Path").GetString() ?? "",
                Cluster: route.Value.GetProperty("ClusterId").GetString() ?? ""))
            .Where(route => route.Path.Length > 0)
            .ToList();
    }
}
