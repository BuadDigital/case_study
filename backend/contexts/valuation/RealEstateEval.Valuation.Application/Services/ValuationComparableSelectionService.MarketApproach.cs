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
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل" });
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        if (await freeze.IsFrozenAsync(vr.Id, cancellationToken))
        {
            return (
                null,
                new Dictionary<string, string> { ["_"] = ValuationReportFreezeRules.FrozenMessageAr });
        }

        var errors = ValuationComparableSelectionRequestRules.ValidateMarketApproach(request);
        if (errors is not null) return (null, errors);

        var header = await repo.FindMarketApproachAsync(valuationRequestId, cancellationToken);
        if (header is null)
        {
            var org = await organizationSettings.GetInternalAsync(cancellationToken);
            header = ValuationComparableSelectionRequestRules.SeedMarketApproach(
                valuationRequestId, org.Valuation);
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

        var org = await organizationSettings.GetInternalAsync(cancellationToken);
        var header = ValuationComparableSelectionRequestRules.SeedMarketApproach(
            valuationRequestId, org.Valuation);
        header.UpdatedAtUtc = _time.UtcNow();
        await repo.AddMarketApproachAsync(header, cancellationToken);
    }
}
