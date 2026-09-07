using RealEstateEval.Application;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// Reviewer actions on pending suggestions: approve / rename keep the row and mark it
/// approved; merge moves its usage onto an active target and retires it. A city merge cannot
/// target itself; the city path also refreshes the selector cache.
/// </summary>
public sealed partial class RegionsService
{
    public async Task ReviewCityAsync(
        Guid cityId,
        ReviewLocationRequest request,
        string reviewerUserId,
        CancellationToken cancellationToken = default)
    {
        var city = await _repo.FindCityAsync(cityId, cancellationToken)
            ?? throw new InvalidOperationException("المدينة غير موجودة.");
        if (city.Status != LocationCatalogStatuses.Pending)
            throw new InvalidOperationException("السجل ليس بانتظار المراجعة.");

        var action = LocationCatalogRules.NormalizeAction(request.Action);
        var now = _time.UtcNow();
        if (LocationCatalogRules.IsApproveOrRename(action))
        {
            var name = LocationCatalogRules.ResolveReviewName(request.NameAr);
            LocationCatalogRules.ApproveCity(city, name, now, reviewerUserId);
        }
        else if (action == LocationCatalogRules.ActionMerge)
        {
            var mergeIntoId = LocationCatalogRules.RequireMergeTarget(request.MergeIntoId);
            if (mergeIntoId == city.Id)
                throw new InvalidOperationException("لا يمكن الدمج على نفس السجل.");

            var target = await _repo.FindActiveCityAsync(mergeIntoId, cancellationToken)
                ?? throw new InvalidOperationException("سجل الدمج غير موجود.");

            LocationCatalogRules.MergeCity(city, target, now, reviewerUserId);
        }
        else
        {
            throw new InvalidOperationException("إجراء غير معروف.");
        }

        await _repo.SaveChangesAsync(cancellationToken);
        await InvalidateCatalogCache(cancellationToken);
    }

    public async Task ReviewDistrictAsync(
        Guid districtId,
        ReviewLocationRequest request,
        string reviewerUserId,
        CancellationToken cancellationToken = default)
    {
        var district = await _repo.FindDistrictAsync(districtId, cancellationToken)
            ?? throw new InvalidOperationException("الحي غير موجود.");
        if (district.Status != LocationCatalogStatuses.Pending)
            throw new InvalidOperationException("السجل ليس بانتظار المراجعة.");

        var action = LocationCatalogRules.NormalizeAction(request.Action);
        var now = _time.UtcNow();
        if (LocationCatalogRules.IsApproveOrRename(action))
        {
            var name = LocationCatalogRules.ResolveReviewName(request.NameAr);
            LocationCatalogRules.ApproveDistrict(district, name, now, reviewerUserId);
        }
        else if (action == LocationCatalogRules.ActionMerge)
        {
            var mergeIntoId = LocationCatalogRules.RequireMergeTarget(request.MergeIntoId);
            var target = await _repo.FindActiveDistrictAsync(mergeIntoId, cancellationToken)
                ?? throw new InvalidOperationException("سجل الدمج غير موجود.");
            LocationCatalogRules.MergeDistrict(district, target, now, reviewerUserId);
        }
        else
        {
            throw new InvalidOperationException("إجراء غير معروف.");
        }

        await _repo.SaveChangesAsync(cancellationToken);
    }
}
