using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPushSubscriptionService
{
    Task<PushConfigDto> GetConfigAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PushSubscriptionDto>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<PushSubscriptionDto> UpsertAsync(
        string userId,
        RegisterPushSubscriptionRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(
        string userId,
        string endpoint,
        CancellationToken cancellationToken = default);

    Task<PushPreferenceDto> GetPreferenceAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<PushPreferenceDto> SetPreferenceAsync(
        string userId,
        bool enabled,
        CancellationToken cancellationToken = default);
}
