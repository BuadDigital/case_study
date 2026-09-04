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
    public Task<IReadOnlyList<DevLoginUserDto>> ListDevLoginUsersAsync(
        CancellationToken cancellationToken = default) =>
        _repo.ListDevLoginUsersAsync(cancellationToken);

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

    public async Task<OrganizationOverviewDto> GetOrganizationOverviewAsync(
        CancellationToken cancellationToken = default)
    {
        var members = await _repo.ListStaffRoleMembershipsAsync(cancellationToken);

        OrgPersonDto? ToPerson(StaffRoleMembership member)
        {
            var orgRole = member.SystemRoles.FirstOrDefault(OrgRoles.IsOrgRole);
            if (orgRole is null)
                return null;

            return new OrgPersonDto
            {
                Id = member.UserId,
                DisplayName = member.DisplayName,
                Email = member.Email,
                JobTitle = member.JobTitle,
                SystemRole = orgRole,
            };
        }

        // GroupBy instead of ToDictionary: duplicate org role (e.g. CDO twice) must not drop the overview.
        var byRole = members
            .Select(ToPerson)
            .Where(person => person is not null)
            .GroupBy(person => person!.SystemRole)
            .ToDictionary(g => g.Key, g => g.First()!);

        return new OrganizationOverviewDto
        {
            Cdo = byRole.GetValueOrDefault(OrgRoles.Cdo),
            Departments =
            [
                new OrgDepartmentDto
                {
                    Code = "STAFF",
                    Title = "الموظفون",
                    Description = "موظفون — كل أنواع التوظيف",
                    IsActive = true,
                },
                new OrgDepartmentDto
                {
                    Code = "PROCUREMENT",
                    Title = "المالية والعقود",
                    Description = "مقدمو خدمة — أفراد ومؤسسات",
                    IsActive = true,
                },
            ],
        };
    }
}
