using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpIdentityDirectory(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IIdentityDirectory
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

        return await LabelsAsync("/api/identity/labels", ids, cancellationToken);
    }

    public async Task<IdentityCompensationProfileDto?> GetCompensationByAssigneeAsync(
        string assigneeId,
        CancellationToken cancellationToken = default)
    {
        var aid = assigneeId?.Trim() ?? "";
        if (aid.Length == 0) return null;
        return await UpstreamJson.GetOrDefaultAsync<IdentityCompensationProfileDto>(
            http,
            httpContext,
            options.Value.IdentityBaseUrl,
            $"/api/identity/compensation?assigneeId={Uri.EscapeDataString(aid)}",
            "UpstreamServices:IdentityBaseUrl",
            cancellationToken);
    }

    public Task<string?> ResolveUserIdForDistributionAssigneeAsync(
        string distributionAssigneeId,
        CancellationToken cancellationToken = default) =>
        UserIdAsync(
            $"/api/identity/user-id-by-assignee?assigneeId={Uri.EscapeDataString(distributionAssigneeId.Trim())}",
            cancellationToken);

    public Task<string?> ResolveUserIdForEmailAsync(
        string email,
        CancellationToken cancellationToken = default) =>
        UserIdAsync(
            $"/api/identity/user-id-by-email?email={Uri.EscapeDataString(email.Trim())}",
            cancellationToken);

    public async Task<IReadOnlyDictionary<string, string>> ResolveUserIdsForDistributionAssigneesAsync(
        IReadOnlyCollection<string> distributionAssigneeIds,
        CancellationToken cancellationToken = default)
    {
        var ids = distributionAssigneeIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .Take(200)
            .ToList();
        if (ids.Count == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);

        return await LabelsAsync("/api/identity/user-ids-by-assignees", ids, cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ResolveUserIdsWithPrototypeRoleAsync(
        string prototypeRole,
        CancellationToken cancellationToken = default)
    {
        var role = prototypeRole.Trim();
        if (role.Length == 0) return [];
        var body = await UpstreamJson.GetAsync<IdentityUserIdsDto>(
            http,
            httpContext,
            options.Value.IdentityBaseUrl,
            $"/api/identity/user-ids-by-role?role={Uri.EscapeDataString(role)}",
            "UpstreamServices:IdentityBaseUrl",
            cancellationToken);
        return body.UserIds;
    }

    public Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesByUserIdsAsync(
        IReadOnlyCollection<string> userIds,
        CancellationToken cancellationToken = default) =>
        LabelsAsync(
            "/api/identity/labels",
            userIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).ToList(),
            cancellationToken);

    public Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesByAssigneeIdsAsync(
        IReadOnlyCollection<string> assigneeIds,
        CancellationToken cancellationToken = default) =>
        LabelsAsync(
            "/api/identity/assignee-labels",
            assigneeIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).ToList(),
            cancellationToken);

    private async Task<string?> UserIdAsync(string path, CancellationToken cancellationToken)
    {
        var body = await UpstreamJson.GetOrDefaultAsync<IdentityUserIdDto>(
            http,
            httpContext,
            options.Value.IdentityBaseUrl,
            path,
            "UpstreamServices:IdentityBaseUrl",
            cancellationToken);
        return string.IsNullOrWhiteSpace(body?.UserId) ? null : body.UserId;
    }

    private async Task<IReadOnlyDictionary<string, string>> LabelsAsync(
        string path,
        IReadOnlyList<string> ids,
        CancellationToken cancellationToken)
    {
        if (ids.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var query = string.Join(",", ids.Take(200));
        var list = await UpstreamJson.GetAsync<List<UserLabelDto>>(
            http,
            httpContext,
            options.Value.IdentityBaseUrl,
            $"{path}?ids={Uri.EscapeDataString(query)}",
            "UpstreamServices:IdentityBaseUrl",
            cancellationToken);
        return list
            .Where(row => !string.IsNullOrWhiteSpace(row.Id) && !string.IsNullOrWhiteSpace(row.DisplayName))
            .GroupBy(row => row.Id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().DisplayName, StringComparer.OrdinalIgnoreCase);
    }
}
