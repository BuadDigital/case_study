using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// <see cref="ILinkedOperationsTaskLookup"/> over the Operations HTTP API (Omar 2026-11-08).
/// </summary>
/// <remarks>
/// How it works: reads the task list searched by the PO number (the list's free text covers it, with the
/// caller's token, so coordination sees the tasks it manages), then keeps the tasks of exactly that PO
/// that name one of the deeds — or none (a task on the whole order) — and are not cancelled and not
/// accepted by their creator (`outputsAcceptedAt`).
/// Edge cases: a blank PO answers nothing; deed numbers compare trimmed; an unreachable API throws.
/// </remarks>
public sealed class HttpLinkedOperationsTaskLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : ILinkedOperationsTaskLookup
{
    private const string Cancelled = "cancelled";

    public async Task<IReadOnlyList<LinkedOperationsTaskFact>> ListOpenAsync(
        string poNumber,
        IReadOnlyCollection<string> deedNumbers,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0) return [];
        var tasks = await UpstreamJson.GetAsync<List<OperationsTaskDto>>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            $"/api/operations-tasks?q={Uri.EscapeDataString(po)}",
            "UpstreamServices:OperationsBaseUrl",
            cancellationToken);
        var deeds = deedNumbers.Select(d => d.Trim()).Where(d => d.Length > 0).ToHashSet(StringComparer.Ordinal);
        return tasks
            .Where(t => string.Equals(t.PoNumber?.Trim(), po, StringComparison.OrdinalIgnoreCase))
            // As the property pages scope a task (`filterOperationsTasksForProperty`): a work-order or
            // multi-deed task covers every deed of its order; a task with deeds covers the ones it names.
            .Where(t => t.Scope is "work_order" or "multi"
                || t.Deeds.Count == 0
                || t.Deeds.Any(d => deeds.Contains(d.Trim())))
            .Where(t => !string.Equals(t.Status, Cancelled, StringComparison.OrdinalIgnoreCase))
            .Where(t => string.IsNullOrWhiteSpace(t.OutputsAcceptedAt))
            .Select(t => new LinkedOperationsTaskFact(t.Id, t.DisplayId, t.Title, t.Status))
            .ToList();
    }
}
