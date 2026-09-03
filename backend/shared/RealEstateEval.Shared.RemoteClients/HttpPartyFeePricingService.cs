using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Case Study visit-fee resolution. Table CRUD stays on the Financial operator API.
/// </summary>
public sealed class HttpPartyFeePricingService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IPartyFeePricingService
{
    private const string Setting = "UpstreamServices:FinancialBaseUrl";

    public Task<IReadOnlyList<PartyFeePricingTableSummaryDto>> ListAsync(
        string? category = null,
        CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    public Task<PartyFeePricingDto> GetActiveAsync(CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    public Task<PartyFeePricingDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    public Task<PartyFeePricingDto> CreateAsync(
        CreatePartyFeePricingTableRequest request,
        CancellationToken cancellationToken = default,
        string actorId = "system") =>
        throw OwnerOnly();

    public Task<PartyFeePricingDto> SaveAsync(
        Guid id,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default,
        string actorId = "system") =>
        throw OwnerOnly();

    public Task<PartyFeePricingDto> ReviseAsync(
        Guid sourceId,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default,
        string actorId = "system") =>
        throw OwnerOnly();

    public Task<PartyFeePricingDto> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default,
        string actorId = "system") =>
        throw OwnerOnly();

    public Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken = default,
        string actorId = "system") =>
        throw OwnerOnly();

    public Task<IReadOnlyList<string>> ListAssignmentsAsync(
        Guid tableId,
        CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    public Task<PartyFeePricingDto> SetAssignmentsAsync(
        Guid tableId,
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken = default,
        string actorId = "system") =>
        throw OwnerOnly();

    public async Task<ResolvedPartyFee> ResolveDefaultFeeAsync(
        WorkflowTaskKind taskKind,
        string partyType,
        decimal? areaM2 = null,
        string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var path = "/api/financial-dispatch/party-fee-pricing/resolve"
            + $"?taskKind={Uri.EscapeDataString(taskKind.ToString())}"
            + $"&partyType={Uri.EscapeDataString(partyType ?? "")}";
        if (areaM2 is not null)
            path += $"&areaM2={areaM2.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}";
        if (!string.IsNullOrWhiteSpace(assigneeId))
            path += $"&assigneeId={Uri.EscapeDataString(assigneeId)}";

        var dto = await UpstreamJson.GetAsync<ResolvedPartyFeeDto>(
            http, httpContext, options.Value.FinancialBaseUrl, path, Setting, cancellationToken);
        return dto.ToFee();
    }

    private static InvalidOperationException OwnerOnly() =>
        new("Manage party-fee pricing tables on the Financial API.");
}
