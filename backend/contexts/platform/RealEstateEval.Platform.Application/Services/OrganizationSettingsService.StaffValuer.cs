using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Rules;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// When a staff user is created or updated as a real-estate appraiser, keep the
/// organization valuers roster in step: upsert a linked row, or deactivate it
/// when the account is disabled or the role is no longer appraiser.
/// </summary>
public sealed partial class OrganizationSettingsService
{
    public async Task<OrganizationSettingsDto> SyncStaffValuerAsync(
        SyncStaffValuerRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var userId = (request.UserId ?? "").Trim();
        if (userId.Length == 0)
            throw new ArgumentOutOfRangeException(nameof(request), "معرّف المستخدم غير صالح.");

        var mode = (request.Mode ?? "").Trim();
        if (!StaffValuerRosterSyncRules.IsUpsert(mode)
            && !string.Equals(mode, StaffValuerRosterSyncRules.DeactivateMode, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentOutOfRangeException(nameof(request), "وضع المزامنة غير صالح.");
        }

        var current = await GetInternalAsync(cancellationToken);
        var nextValuers = StaffValuerRosterSyncRules.Apply(
            current.Valuers,
            userId,
            request.DisplayName ?? "",
            StaffValuerRosterSyncRules.IsUpsert(mode));
        return await SaveAsync(
            new SaveOrganizationSettingsRequest { Valuers = nextValuers },
            actorId,
            cancellationToken);
    }
}
