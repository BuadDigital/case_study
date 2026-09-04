using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Identity.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IStaffRegistrationRepository"/>. The only place the staff
/// registration use case reaches <see cref="IdentityDbContext"/>: the profile rows, the
/// uniqueness guards, the refresh tokens a disable revokes, the yearly reference sequence, and
/// the audit rows each write leaves.
/// </summary>
public sealed class StaffRegistrationRepository : IStaffRegistrationRepository
{
    private readonly IdentityDbContext _db;
    private readonly DatabaseOptions _dbOptions;
    private readonly TimeProvider _time;

    public StaffRegistrationRepository(
        IdentityDbContext db,
        IOptions<DatabaseOptions>? dbOptions = null,
        TimeProvider? time = null)
    {
        _db = db;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
        _time = time ?? TimeProvider.System;
    }

    public async Task<IReadOnlyList<DevLoginUserDto>> ListDevLoginUsersAsync(
        CancellationToken cancellationToken)
    {
        return await (
            from user in _db.Users.AsNoTracking()
            join profile in _db.UserProfiles.AsNoTracking() on user.Id equals profile.UserId
            where profile.Status == UserStatus.Active && user.UserName != null
            orderby user.UserName == "sliman" ? 0 : 1, user.DisplayName
            select new DevLoginUserDto
            {
                Username = user.UserName!,
                Label = string.IsNullOrWhiteSpace(profile.JobTitle)
                    ? user.DisplayName
                    : $"{user.DisplayName} — {profile.JobTitle}",
            }).ToListAsync(cancellationToken);
    }

    public async Task<UserInfoDto?> GetIdentityUserAsync(
        string userId,
        CancellationToken cancellationToken) =>
        await _db.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new UserInfoDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                DisplayName = user.DisplayName,
            })
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<UserListItemDto>> ListAsync(CancellationToken cancellationToken)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var rows = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .OrderByDescending(p => p.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);

        var rolesByUser = await RolesByUserAsync(
            rows.Select(p => p.UserId).ToList(),
            cancellationToken);

        return rows
            .Select(p => RegistrationMapper.ToListItem(
                p.User,
                p,
                rolesByUser.GetValueOrDefault(p.UserId, [])))
            .ToList();
    }

    public async Task<UserListItemDto?> GetByUserIdAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var profile = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

        var roles = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where ur.UserId == userId && r.Name != null
            select r.Name!
        ).ToListAsync(cancellationToken);

        if (profile is null)
        {
            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
            if (user is null)
                return null;

            return new UserListItemDto
            {
                Id = user.Id,
                DisplayName = user.DisplayName,
                JobTitle = string.Empty,
                Email = user.Email ?? string.Empty,
                UserName = user.UserName ?? string.Empty,
                ContractType = ContractType.Internal,
                Status = UserStatus.Active,
                PhoneNumber = user.PhoneNumber,
                CreatedAtUtc = _time.UtcNow(),
                SystemRoles = roles,
                Details = [],
            };
        }

        return RegistrationMapper.ToListItem(profile.User, profile, roles);
    }

    public async Task<IReadOnlyList<StaffRoleMembership>> ListStaffRoleMembershipsAsync(
        CancellationToken cancellationToken)
    {
        var rows = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .ToListAsync(cancellationToken);

        var rolesByUser = await RolesByUserAsync(
            rows.Select(p => p.UserId).ToList(),
            cancellationToken);

        return rows
            .Select(p => new StaffRoleMembership(
                p.UserId,
                p.User.DisplayName,
                p.User.Email ?? string.Empty,
                p.JobTitle,
                rolesByUser.GetValueOrDefault(p.UserId, [])))
            .ToList();
    }

    public async Task<IReadOnlyList<string>> ListProfiledUserIdsAsync(
        CancellationToken cancellationToken) =>
        await _db.UserProfiles
            .Select(p => p.UserId)
            .ToListAsync(cancellationToken);

    public Task<bool> UserNameExistsAsync(string userName, CancellationToken cancellationToken) =>
        _db.Users.AsNoTracking().AnyAsync(u => u.UserName == userName, cancellationToken);

    public Task<bool> EmailInUseAsync(
        string email,
        string? exceptUserId,
        CancellationToken cancellationToken)
    {
        var query = _db.Users.AsNoTracking().Where(candidate => candidate.Email == email);
        if (exceptUserId is not null)
            query = query.Where(candidate => candidate.Id != exceptUserId);
        return query.AnyAsync(cancellationToken);
    }

    public Task<bool> PhoneNumberInUseAsync(
        string phoneNumber,
        string? exceptUserId,
        CancellationToken cancellationToken)
    {
        var query = _db.Users.AsNoTracking().Where(candidate => candidate.PhoneNumber == phoneNumber);
        if (exceptUserId is not null)
            query = query.Where(candidate => candidate.Id != exceptUserId);
        return query.AnyAsync(cancellationToken);
    }

    public Task<bool> NationalIdInUseAsync(
        string nationalId,
        string? exceptUserId,
        CancellationToken cancellationToken)
    {
        var query = _db.UserProfiles.AsNoTracking().Where(candidate => candidate.NationalId == nationalId);
        if (exceptUserId is not null)
            query = query.Where(candidate => candidate.UserId != exceptUserId);
        return query.AnyAsync(cancellationToken);
    }

    public async Task<StaffProfileState?> FindProfileAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var row = await _db.UserProfiles
            .FirstOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        return row is null ? null : ToState(row);
    }

    public Task AddProfileAsync(StaffProfileState profile, CancellationToken cancellationToken)
    {
        var row = new UserProfile { UserId = profile.UserId };
        Apply(row, profile);
        row.ReferenceNumber = profile.ReferenceNumber;
        row.CreatedAtUtc = profile.CreatedAtUtc;
        _db.UserProfiles.Add(row);
        return Task.CompletedTask;
    }

    public async Task ApplyProfileAsync(
        StaffProfileState profile,
        CancellationToken cancellationToken)
    {
        var row = await _db.UserProfiles
            .FirstOrDefaultAsync(candidate => candidate.UserId == profile.UserId, cancellationToken);
        if (row is null)
            return;

        Apply(row, profile);
    }

    public async Task RevokeActiveRefreshTokensAsync(
        string userId,
        DateTime revokedAtUtc,
        string reason,
        CancellationToken cancellationToken)
    {
        var activeTokens = await _db.RefreshTokens
            .Where(token => token.UserId == userId && token.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var token in activeTokens)
        {
            token.RevokedAtUtc = revokedAtUtc;
            token.RevokedReason = reason;
        }
    }

    public Task<(string? Reference, string? Error)> AllocateUserReferenceAsync(
        DateTime utcNow,
        CancellationToken cancellationToken) =>
        ReferenceSequenceAllocator.AllocateYearlyAsync(
            _db,
            DatabaseSchemas.Identity,
            ReferenceNumbering.User,
            utcNow,
            cancellationToken);

    public Task AddAuditLogAsync(AuditLog entry, CancellationToken cancellationToken)
    {
        _db.AuditLogs.Add(entry);
        return Task.CompletedTask;
    }

    public async Task<IStaffWriteTransaction?> BeginTransactionAsync(
        CancellationToken cancellationToken) =>
        _db.Database.IsRelational()
            ? new EfStaffWriteTransaction(await _db.Database.BeginTransactionAsync(cancellationToken))
            : null;

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        _db.SaveChangesAsync(cancellationToken);

    private async Task<Dictionary<string, IReadOnlyList<string>>> RolesByUserAsync(
        IReadOnlyCollection<string> userIds,
        CancellationToken cancellationToken)
    {
        var roleRows = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where userIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name }
        ).ToListAsync(cancellationToken);

        return roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<string>)g.Select(x => x.RoleName).ToList()!);
    }

    private static StaffProfileState ToState(UserProfile row) => new()
    {
        UserId = row.UserId,
        RoleId = row.RoleId,
        JobTitle = row.JobTitle,
        PermissionLevel = row.PermissionLevel,
        ContractType = row.ContractType,
        RegistrationSource = row.RegistrationSource,
        Department = row.Department,
        City = row.City,
        NationalId = row.NationalId,
        AvatarUrl = row.AvatarUrl,
        InspectorType = row.InspectorType,
        HasCompensation = row.HasCompensation,
        FeeValueSar = row.FeeValueSar,
        Iban = row.Iban,
        TaxNumber = row.TaxNumber,
        CommercialRegistration = row.CommercialRegistration,
        JoinedAt = row.JoinedAt,
        DistributionAssigneeId = row.DistributionAssigneeId,
        Status = row.Status,
        ReferenceNumber = row.ReferenceNumber,
        CreatedAtUtc = row.CreatedAtUtc,
        UpdatedAtUtc = row.UpdatedAtUtc,
    };

 /// <summary>
 /// Copies the decided state onto the row. Columns the use case never reasons about —
 /// reviewer city coverage, last login, and on an update the reference number and creation
 /// stamp — are deliberately left untouched.
 /// </summary>
    private static void Apply(UserProfile row, StaffProfileState profile)
    {
        row.RoleId = profile.RoleId;
        row.JobTitle = profile.JobTitle;
        row.PermissionLevel = profile.PermissionLevel;
        row.ContractType = profile.ContractType;
        row.RegistrationSource = profile.RegistrationSource;
        row.Department = profile.Department;
        row.City = profile.City;
        row.NationalId = profile.NationalId;
        row.AvatarUrl = profile.AvatarUrl;
        row.InspectorType = profile.InspectorType;
        row.HasCompensation = profile.HasCompensation;
        row.FeeValueSar = profile.FeeValueSar;
        row.Iban = profile.Iban;
        row.TaxNumber = profile.TaxNumber;
        row.CommercialRegistration = profile.CommercialRegistration;
        row.JoinedAt = profile.JoinedAt;
        row.DistributionAssigneeId = profile.DistributionAssigneeId;
        row.Status = profile.Status;
        row.UpdatedAtUtc = profile.UpdatedAtUtc;
    }

    private sealed class EfStaffWriteTransaction(IDbContextTransaction transaction)
        : IStaffWriteTransaction
    {
        public Task CommitAsync(CancellationToken cancellationToken) =>
            transaction.CommitAsync(cancellationToken);

        public ValueTask DisposeAsync() => transaction.DisposeAsync();
    }
}
