using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpUserLabelLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IUserLabelLookup
{
    public async Task<string> ResolveAsync(string? raw, CancellationToken cancellationToken = default)
    {
        var map = await ResolveManyAsync([raw], cancellationToken);
        var key = PersonLabelResolver.NormalizeSystemLabel(raw);
        if (key.Length == 0) return "";
        return PersonLabelResolver.ApplyResolved(key, map);
    }

    public async Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
        IEnumerable<string?> raws,
        CancellationToken cancellationToken = default)
    {
        var ids = raws
            .Select(PersonLabelResolver.NormalizeSystemLabel)
            .Where(PersonLabelResolver.LooksLikeUserId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(200)
            .ToList();
        if (ids.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var query = string.Join(",", ids);
        var list = await UpstreamJson.GetAsync<List<UserLabelDto>>(
            http,
            httpContext,
            options.Value.IdentityBaseUrl,
            $"/api/identity/labels?ids={Uri.EscapeDataString(query)}",
            "UpstreamServices:IdentityBaseUrl",
            cancellationToken);
        return list
            .Where(row => !string.IsNullOrWhiteSpace(row.Id) && !string.IsNullOrWhiteSpace(row.DisplayName))
            .GroupBy(row => row.Id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().DisplayName, StringComparer.OrdinalIgnoreCase);
    }
}
