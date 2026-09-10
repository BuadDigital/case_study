using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Notifications;
using RealEstateEval.Shared.Contracts;
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

        await NotifySuggesterAsync(city.CreatedByUserId, action, city.NameAr, "المدينة", city.Id, cancellationToken);
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

        await NotifySuggesterAsync(
            district.CreatedByUserId, action, district.NameAr, "الحي", district.Id, cancellationToken);
    }

    /// <summary>
    /// Closes the loop on a suggestion: whoever proposed the row hears the outcome. A merge is
    /// the rejection-shaped case — their row is retired onto an existing one.
    /// </summary>
    private async Task NotifySuggesterAsync(
        string? suggestedByUserId,
        string action,
        string finalName,
        string kindLabel,
        Guid entityId,
        CancellationToken cancellationToken)
    {
        var userId = suggestedByUserId?.Trim();
        if (_notifications is null || string.IsNullOrWhiteSpace(userId)) return;

        var request = action == LocationCatalogRules.ActionMerge
            ? ReturnedForCorrectionNotice.Build(
                title: $"دُمج اقتراح {kindLabel}",
                summary: $"دُمج اقتراحك على سجل قائم باسم «{finalName}»",
                reason: null,
                href: "/location-pending",
                category: NotificationContract.Categories.System,
                entityType: null,
                entityId: entityId.ToString(),
                sourceEvent: $"location-suggestion-merged:{entityId}")
            : new CreateUserNotificationRequest
            {
                Title = $"اعتُمد اقتراح {kindLabel}",
                Body = $"اعتُمد اقتراحك باسم «{finalName}».",
                Tone = NotificationContract.Tones.Success,
                Href = "/location-pending",
                Category = NotificationContract.Categories.System,
                EntityId = entityId.ToString(),
                SourceEvent = $"location-suggestion-approved:{entityId}",
            };

        await _notifications.CreateForUserAsync(userId, request, cancellationToken);
    }
}
