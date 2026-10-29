using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

public sealed partial class ValuationComparableSelectionService
{
    public async Task<(ValuationComparableSelectionListDto? Result, Dictionary<string, string>? Errors)>
        SaveMarketApproachAsync(
            Guid valuationRequestId,
            SaveValuationMarketApproachRequest request,
            CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        var blocked = await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل", cancellationToken);
        if (blocked is not null)
            return (null, new Dictionary<string, string> { ["_"] = blocked });

        var errors = ValuationComparableSelectionRequestRules.ValidateMarketApproach(request);
        if (errors is not null) return (null, errors);

        var header = await repo.FindMarketApproachAsync(valuationRequestId, cancellationToken);
        if (header is null)
        {
            header = await SeedMarketApproachAsync(vr, cancellationToken);
            await repo.AddMarketApproachAsync(header, cancellationToken);
        }

        ValuationComparableSelectionRequestRules.ApplyMarketApproach(header, request);
        header.UpdatedAtUtc = _time.UtcNow();
        await repo.SaveChangesAsync(cancellationToken);
        return (await ListAsync(valuationRequestId, cancellationToken), null);
    }

    private async Task EnsureMarketApproachHeaderAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken)
    {
        var exists = await repo.MarketApproachExistsAsync(valuationRequestId, cancellationToken);
        if (exists) return;

        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null) return;
        var header = await SeedMarketApproachAsync(vr, cancellationToken);
        header.UpdatedAtUtc = _time.UtcNow();
        await repo.AddMarketApproachAsync(header, cancellationToken);
    }

    /// <summary>
    /// A new market header: organization coefficients, and the basis this property opens on
    /// (whole property for a building, per m² for land — by its type and the saved scope).
    /// </summary>
    private async Task<ValuationMarketApproach> SeedMarketApproachAsync(
        ValuationRequest vr,
        CancellationToken cancellationToken)
    {
        var org = await organizationSettings.GetInternalAsync(cancellationToken);
        var settings = await repo.GetApproachSettingsAsync(vr.Id, cancellationToken);
        return ValuationComparableSelectionRequestRules.SeedMarketApproach(
            vr.Id, org.Valuation, vr.PropertyType, settings?.CostScopeKey);
    }
}
