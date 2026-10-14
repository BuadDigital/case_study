using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Application.Services;

/// <summary>
/// The read half of staff registration. The list/detail projections are built in the database
/// by <see cref="IStaffRegistrationRepository"/>; what stays here is the shaping the rules own —
/// who counts as a distribution assignee and which identity role fills an organization seat.
/// </summary>
public partial class UserRegistrationService
{

    public Task<UserInfoDto?> GetIdentityUserAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        string.IsNullOrWhiteSpace(userId)
            ? Task.FromResult<UserInfoDto?>(null)
            : _repo.GetIdentityUserAsync(userId, cancellationToken);

    public Task<IReadOnlyList<UserListItemDto>> ListAsync(
        CancellationToken cancellationToken = default) =>
        _repo.ListAsync(cancellationToken);

    public Task<UserListItemDto?> GetByUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        string.IsNullOrWhiteSpace(userId)
            ? Task.FromResult<UserListItemDto?>(null)
            : _repo.GetByUserIdAsync(userId, cancellationToken);

    public async Task<IReadOnlyList<UserListItemDto>> ListDistributionAssigneesAsync(
        CancellationToken cancellationToken = default)
    {
        var all = await ListAsync(cancellationToken);
        return all
            .Where(u =>
                u.Status == UserStatus.Active
                && !string.IsNullOrWhiteSpace(u.DistributionAssigneeId))
            .ToList();
    }
}
