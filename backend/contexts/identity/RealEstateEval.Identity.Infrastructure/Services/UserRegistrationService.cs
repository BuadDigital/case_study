using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Permissions;
using System.Text.RegularExpressions;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Infrastructure.Services;

public class UserRegistrationService : IUserRegistrationService
{
    private readonly IdentityDbContext _db;
    private readonly IAuditLogAppend? _auditAppend;
    private readonly List<AuditLog> _pendingRemoteAudit = [];
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IOptions<DataProtectionTokenProviderOptions> _activationTokenOptions;
    private readonly IAuditLogWriter _audit;
    private readonly IAuthSessionService _sessions;
    private readonly DatabaseOptions _dbOptions;
    private readonly TimeProvider _time;

    public UserRegistrationService(
        IdentityDbContext db,
        UserManager<ApplicationUser> userManager,
        IOptions<DataProtectionTokenProviderOptions> activationTokenOptions,
        IAuditLogWriter audit,
        IAuthSessionService sessions,
        IOptions<DatabaseOptions>? dbOptions = null,
        IAuditLogAppend? auditAppend = null,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _auditAppend = auditAppend;
        _userManager = userManager;
        _activationTokenOptions = activationTokenOptions;
        _audit = audit;
        _sessions = sessions;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    public async Task<IReadOnlyList<DevLoginUserDto>> ListDevLoginUsersAsync(
        CancellationToken cancellationToken = default)
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
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return null;

        return await _db.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new UserInfoDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                DisplayName = user.DisplayName,
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UserListItemDto>> ListAsync(
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default)
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

        var userIds = rows.Select(p => p.UserId).ToList();
        var roleRows = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where userIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name }
        ).ToListAsync(cancellationToken);

        var rolesByUser = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.RoleName).ToList());

        return rows
            .Where(p => sourceScope is null || p.RegistrationSource == sourceScope.Value)
            .Select(p => RegistrationMapper.ToListItem(
                p.User,
                p,
                rolesByUser.GetValueOrDefault(p.UserId, [])))
            .ToList();
    }

    public async Task<UserListItemDto?> GetByUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return null;

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
                RegistrationSource = RegistrationSource.Hr,
                PhoneNumber = user.PhoneNumber,
                CreatedAtUtc = _time.UtcNow(),
                SystemRoles = roles,
                Details = [],
            };
        }

        return RegistrationMapper.ToListItem(profile.User, profile, roles);
    }

    public async Task<IReadOnlyList<UserListItemDto>> ListDistributionAssigneesAsync(
        CancellationToken cancellationToken = default)
    {
        var all = await ListAsync(null, cancellationToken);
        return all
            .Where(u =>
                u.Status == UserStatus.Active
                && !string.IsNullOrWhiteSpace(u.DistributionAssigneeId))
            .ToList();
    }

    public async Task<OrganizationOverviewDto> GetOrganizationOverviewAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .ToListAsync(cancellationToken);

        var userIds = rows.Select(p => p.UserId).ToList();
        var roleRows = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where userIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name }
        ).ToListAsync(cancellationToken);

        var rolesByUser = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.RoleName).ToList());

        OrgPersonDto? ToPerson(UserProfile p)
        {
            var roles = rolesByUser.GetValueOrDefault(p.UserId, []);
            var orgRole = roles.FirstOrDefault(r =>
                OrgRoles.IsOrgRole(r)
                || OrgRoles.RetiredDepartmentAdmins.Contains(r));
            if (orgRole is null)
                return null;

            return new OrgPersonDto
            {
                Id = p.UserId,
                DisplayName = p.User.DisplayName,
                Email = p.User.Email ?? string.Empty,
                JobTitle = p.JobTitle,
                SystemRole = orgRole,
            };
        }

        // GroupBy بدل ToDictionary: تكرار الدور التنظيمي (مثل CDO مرتين) يجب ألا يُسقط النظرة العامة.
        var byRole = rows
            .Select(p => (Profile: p, Person: ToPerson(p)))
            .Where(x => x.Person is not null)
            .GroupBy(x => x.Person!.SystemRole)
            .ToDictionary(g => g.Key, g => g.First().Person!);

        return new OrganizationOverviewDto
        {
            Cdo = byRole.GetValueOrDefault(OrgRoles.Cdo),
            Departments =
            [
                new OrgDepartmentDto
                {
                    Code = "HR",
                    Title = "الموارد البشرية",
                    Description = "موظفون — كل أنواع التوظيف",
                    IsActive = true,
                    Admin = byRole.GetValueOrDefault(OrgRoles.HrAdmin),
                },
                new OrgDepartmentDto
                {
                    Code = "PROCUREMENT",
                    Title = "المالية والعقود",
                    Description = "مقدمو خدمة — أفراد ومؤسسات",
                    IsActive = true,
                    Admin = byRole.GetValueOrDefault(OrgRoles.ProcAdmin),
                },
                new OrgDepartmentDto
                {
                    Code = "CRM",
                    Title = "علاقات العملاء",
                    Description = "عملاء محتملون وفعليون",
                    IsActive = false,
                    Admin = byRole.GetValueOrDefault(OrgRoles.CrmAdmin),
                },
            ],
        };
    }

    public async Task<int> DeleteAllRegisteredAsync(
        CancellationToken cancellationToken = default)
    {
        const string protectedEmail = "admin@local.dev";

        var userIds = await _db.UserProfiles
            .Select(p => p.UserId)
            .ToListAsync(cancellationToken);

        var deleted = 0;
        foreach (var userId in userIds)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user is null)
                continue;

            var email = (user.Email ?? "").Trim().ToLowerInvariant();
            if (email == protectedEmail)
                continue;

            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Any(OrgRoles.IsOrgRole))
                continue;

            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "Failed to delete user " + userId + ": "
                    + string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            deleted++;
        }

        return deleted;
    }

    public async Task<(CreateStaffUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateStaffAsync(
        CreateStaffUserRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var errors = ValidateCreateStaffRequest(request);
        if (errors.Count > 0)
            return (null, errors);

        var roleId = request.RoleId.Trim();
        var jobTitle = PrototypeRoleResolver.JobTitleForRoleId(roleId)!;
        var defaults = StaffRoleDefaults.For(roleId);
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedMobile = NormalizeMobile(request.Mobile);
        var displayName = request.DisplayName.Trim();
        var nationalId = request.NationalId.Trim();

        var existingEmail = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existingEmail is not null)
        {
            return (null, new Dictionary<string, string>
            {
                ["email"] = "البريد الإلكتروني مستخدم مسبقاً.",
            });
        }

        if (await _db.Users.AsNoTracking()
                .AnyAsync(candidate => candidate.PhoneNumber == normalizedMobile, cancellationToken))
        {
            return (null, new Dictionary<string, string>
            {
                ["mobile"] = "رقم الجوال مستخدم مسبقاً.",
            });
        }

        if (await _db.UserProfiles.AsNoTracking()
                .AnyAsync(candidate => candidate.NationalId == nationalId, cancellationToken))
        {
            return (null, new Dictionary<string, string>
            {
                ["nationalId"] = "رقم الهوية مستخدم مسبقاً.",
            });
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(cancellationToken)
            : null;
        var userName = await AllocateUniqueUserNameAsync(normalizedEmail, cancellationToken);

        var user = new ApplicationUser
        {
            UserName = userName,
            Email = normalizedEmail,
            EmailConfirmed = true,
            DisplayName = displayName,
            PhoneNumber = normalizedMobile,
            PhoneNumberConfirmed = false,
        };

 // Deliberately password-less: the account cannot sign in until its holder
 // redeems an activation ticket, so no credential ever crosses the API boundary.
        var createResult = await _userManager.CreateAsync(user);
        if (!createResult.Succeeded)
        {
            return (null, new Dictionary<string, string>
            {
                ["_form"] = string.Join(" ", createResult.Errors.Select(e => e.Description)),
            });
        }

        foreach (var identityRole in defaults.IdentityRoles.Distinct())
        {
            var roleResult = await _userManager.AddToRoleAsync(user, identityRole);
            if (!roleResult.Succeeded)
            {
                return (null, new Dictionary<string, string>
                {
                    ["_form"] = string.Join(" ", roleResult.Errors.Select(e => e.Description)),
                });
            }
        }

        var (department, departmentError) = SupervisingDepartments.ResolveForStaff(
            roleId,
            request.Department);
        if (departmentError is not null)
        {
            return (null, new Dictionary<string, string> { ["department"] = departmentError });
        }

        var profile = new UserProfile
        {
            UserId = user.Id,
            RegistrationSource = RegistrationSource.Hr,
            ContractType = defaults.ContractType,
            RoleId = roleId,
            JobTitle = jobTitle,
            Department = department,
            City = request.City.Trim(),
            NationalId = nationalId,
            AvatarUrl = Clean(request.AvatarUrl),
            InspectorType = roleId == "field-inspector"
                ? request.InspectorType!.Trim().ToLowerInvariant()
                : null,
            HasCompensation = request.HasCompensation ?? false,
            FeeValueSar = request.HasCompensation == true ? request.FeeValueSar : null,
            Iban = string.IsNullOrWhiteSpace(request.Iban)
                ? null
                : request.Iban.Replace(" ", "").ToUpperInvariant(),
            TaxNumber = Clean(request.TaxNumber),
            CommercialRegistration = Clean(request.CommercialRegistration),
            JoinedAt = request.JoinedAt,
            DistributionAssigneeId = BuildDistributionAssigneeId(roleId, userName),
            PermissionLevel = defaults.PermissionLevel,
            Status = UserStatus.PendingActivation,
            CreatedAtUtc = _time.UtcNow(),
        };
        if (roleId == "engineering-office")
            profile.RegistrationSource = RegistrationSource.Proc;

        _db.UserProfiles.Add(profile);
        AddAudit(_audit.Create(
            actorId,
            "USER_CREATED",
            "user",
            user.Id,
            null,
            new
            {
                user.DisplayName,
                user.Email,
                profile.RoleId,
                profile.City,
                profile.Department,
                profile.ContractType,
                profile.Status,
            }));
        await SaveIdentityAsync(cancellationToken);
        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        var roles = (IReadOnlyList<string>)[.. await _userManager.GetRolesAsync(user)];
        var dto = RegistrationMapper.ToListItem(user, profile, roles);
        return (new CreateStaffUserResponseDto
        {
            User = dto,
            UserName = userName,
            ActivationRequired = true,
        }, null);
    }

    public async Task<(UserListItemDto? Result, Dictionary<string, string>? Errors)> UpdateStaffAsync(
        string userId,
        UpdateStaffUserRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (null, FormError("معرّف المستخدم غير صالح."));

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return (null, FormError("المستخدم غير موجود."));

        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        if (profile is null)
            return (null, FormError("ملف المستخدم غير موجود."));

 // Resolve the target state first: an absent member keeps the stored value, and an
 // empty string clears an optional one.
        var roleId = request.RoleId is null ? profile.RoleId : request.RoleId.Trim();
        var displayName = request.DisplayName is null
            ? user.DisplayName
            : request.DisplayName.Trim();
        var email = request.Email is null
            ? user.Email
            : request.Email.Trim().ToLowerInvariant();
        var mobile = request.Mobile is null
            ? user.PhoneNumber
            : NormalizeMobile(request.Mobile);
        var city = request.City is null ? profile.City : request.City.Trim();
        var nationalId = request.NationalId is null
            ? profile.NationalId
            : request.NationalId.Trim();
        var inspectorType = roleId == "field-inspector"
            ? ResolveOptional(request.InspectorType, profile.InspectorType)?.ToLowerInvariant()
            : null;
        var hasCompensation = request.HasCompensation ?? profile.HasCompensation;
        var feeValueSar = hasCompensation ? request.FeeValueSar ?? profile.FeeValueSar : null;
        var iban = ResolveOptional(request.Iban, profile.Iban)?.Replace(" ", "").ToUpperInvariant();
        var status = request.Status ?? profile.Status;

        var errors = await ValidateUpdateStaffAsync(
            userId,
            roleId,
            email,
            mobile,
            city,
            nationalId,
            inspectorType,
            hasCompensation,
            feeValueSar,
            status,
            profile.Status,
            cancellationToken);
        if (errors.Count > 0)
            return (null, errors);

        if (status != profile.Status && status == UserStatus.Disabled)
        {
            var refusal = DisableRefusalReason(user, userId, actorId);
            if (refusal is not null)
                return (null, FormError(refusal));
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var changes = new Dictionary<string, AuditValueChange>(StringComparer.Ordinal);

        void Track(string field, object? before, object? after)
        {
            if (Equals(before, after)) return;
            changes[field] = new AuditValueChange(before, after);
        }

        Track("displayName", user.DisplayName, displayName);
        Track("email", user.Email, email);
        Track("mobile", user.PhoneNumber, mobile);
        Track("city", profile.City, city);
        Track("nationalId", profile.NationalId, nationalId);
        Track("inspectorType", profile.InspectorType, inspectorType);
        Track("hasCompensation", profile.HasCompensation, hasCompensation);
        Track("feeValueSar", profile.FeeValueSar, feeValueSar);
 // Billing identifiers are recorded as presence only: the audit trail must prove that
 // an IBAN changed without storing the account number itself.
        Track("iban", profile.Iban is null ? "unset" : "set", iban is null ? "unset" : "set");

        var identityChanged =
            !string.Equals(user.DisplayName, displayName, StringComparison.Ordinal)
            || !string.Equals(user.Email, email, StringComparison.Ordinal)
            || !string.Equals(user.PhoneNumber, mobile, StringComparison.Ordinal);

        if (!string.Equals(user.PhoneNumber, mobile, StringComparison.Ordinal))
            user.PhoneNumberConfirmed = false;
        user.DisplayName = displayName;
        user.Email = email;
        user.PhoneNumber = mobile;

        profile.City = city;
        profile.NationalId = nationalId;
        profile.InspectorType = inspectorType;
        profile.HasCompensation = hasCompensation;
        profile.FeeValueSar = feeValueSar;
        profile.Iban = iban;

        var avatarUrl = ResolveOptional(request.AvatarUrl, profile.AvatarUrl);
        Track("avatarUrl", profile.AvatarUrl, avatarUrl);
        profile.AvatarUrl = avatarUrl;

        var taxNumber = ResolveOptional(request.TaxNumber, profile.TaxNumber);
        Track("taxNumber", profile.TaxNumber, taxNumber);
        profile.TaxNumber = taxNumber;

        var commercialRegistration =
            ResolveOptional(request.CommercialRegistration, profile.CommercialRegistration);
        Track("commercialRegistration", profile.CommercialRegistration, commercialRegistration);
        profile.CommercialRegistration = commercialRegistration;

        var joinedAt = request.JoinedAt ?? profile.JoinedAt;
        Track("joinedAt", profile.JoinedAt, joinedAt);
        profile.JoinedAt = joinedAt;

        var departmentBefore = profile.Department;
        if (!string.Equals(profile.RoleId, roleId, StringComparison.Ordinal))
        {
            Track("roleId", profile.RoleId, roleId);
            await ApplyRoleChangeAsync(user, profile, roleId!, request.Department);
        }

        var (department, departmentError) = SupervisingDepartments.ResolveForStaff(
            roleId!,
            request.Department ?? profile.Department);
        if (departmentError is not null)
            return (null, new Dictionary<string, string> { ["department"] = departmentError });
        Track("department", departmentBefore, department);
        profile.Department = department;

        if (changes.Count > 0)
        {
            profile.UpdatedAtUtc = _time.UtcNow();
            AddAudit(_audit.CreateFromChanges(
                actorId,
                "USER_UPDATED",
                "user",
                userId,
                changes));
        }

        if (status != profile.Status)
        {
            await ApplyStatusChangeAsync(user, profile, status, actorId, cancellationToken);
        }

        if (identityChanged)
        {
 // UserManager refreshes the normalized email and saves every tracked change,
 // so the profile row and audit entry commit in the same round trip.
            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return (null, FormError(
                    string.Join(" ", updateResult.Errors.Select(e => e.Description))));
            }
        }
        else
        {
            await SaveIdentityAsync(cancellationToken);
        }

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        var roles = (IReadOnlyList<string>)[.. await _userManager.GetRolesAsync(user)];
        return (RegistrationMapper.ToListItem(user, profile, roles), null);
    }

    public async Task<(bool Ok, string? Error)> UnlockStaffAsync(
        string userId,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (false, "معرّف المستخدم غير صالح.");

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return (false, "المستخدم غير موجود.");

        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        if (profile?.Status == UserStatus.Disabled)
            return (false, "الحساب معطّل — أعد تفعيله قبل فك القفل.");

        await _userManager.SetLockoutEndDateAsync(user, null);
        await _userManager.ResetAccessFailedCountAsync(user);
        if (profile is not null && profile.Status == UserStatus.Locked)
        {
            profile.Status = UserStatus.Active;
            profile.UpdatedAtUtc = _time.UtcNow();
        }

        AddAudit(_audit.Create(
            actorId,
            "USER_UNLOCKED",
            "user",
            userId,
            new { locked = true },
            new { locked = false }));
        await SaveIdentityAsync(cancellationToken);
        return (true, null);
    }

 /// <summary>
 /// Re-derives the job title, permission level, contract and identity roles for a new role.
 /// The distribution assignee id is deliberately preserved: it is referenced by existing
 /// work orders, so rewriting it would orphan live assignments.
 /// </summary>
    private async Task ApplyRoleChangeAsync(
        ApplicationUser user,
        UserProfile profile,
        string roleId,
        string? requestedDepartment)
    {
        var previous = profile.RoleId is null ? null : StaffRoleDefaults.TryFor(profile.RoleId);
        var defaults = StaffRoleDefaults.For(roleId);

        profile.RoleId = roleId;
        profile.JobTitle = PrototypeRoleResolver.JobTitleForRoleId(roleId)!;
        profile.PermissionLevel = defaults.PermissionLevel;
        profile.ContractType = defaults.ContractType;
        profile.RegistrationSource = roleId == "engineering-office"
            ? RegistrationSource.Proc
            : RegistrationSource.Hr;
        if (roleId == "section-supervisor")
        {
 // Keep the stored department unless the request supplies a selectable one; the
 // subsequent ResolveForStaff call rejects an invalid/missing selection.
            var (selected, _) = SupervisingDepartments.ResolveForStaff(roleId, requestedDepartment);
            if (selected is not null)
                profile.Department = selected;
        }
        else
        {
            profile.Department = SupervisingDepartments.DeriveForRole(roleId);
        }
        if (profile.DistributionAssigneeId is null)
            profile.DistributionAssigneeId = BuildDistributionAssigneeId(roleId, user.UserName ?? "");

        var currentRoles = await _userManager.GetRolesAsync(user);
        var target = defaults.IdentityRoles.Distinct().ToList();
        var stale = (previous?.IdentityRoles ?? [])
            .Where(role => !target.Contains(role) && currentRoles.Contains(role));
        foreach (var role in stale)
            await _userManager.RemoveFromRoleAsync(user, role);
        foreach (var role in target.Where(role => !currentRoles.Contains(role)))
            await _userManager.AddToRoleAsync(user, role);

        await _sessions.RevokeAllForUserAsync(user.Id, "roles-changed");
    }

    private async Task ApplyStatusChangeAsync(
        ApplicationUser user,
        UserProfile profile,
        UserStatus status,
        string actorId,
        CancellationToken cancellationToken)
    {
        var previous = profile.Status;
        profile.Status = status;
        profile.UpdatedAtUtc = _time.UtcNow();

        if (status == UserStatus.Disabled)
        {
            var activeTokens = await _db.RefreshTokens
                .Where(token => token.UserId == user.Id && token.RevokedAtUtc == null)
                .ToListAsync(cancellationToken);
            foreach (var token in activeTokens)
            {
                token.RevokedAtUtc = _time.UtcNow();
                token.RevokedReason = "user-disabled";
            }

            await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue);
        }
        else
        {
            await _userManager.SetLockoutEndDateAsync(user, null);
            await _userManager.ResetAccessFailedCountAsync(user);
        }

        AddAudit(_audit.Create(
            actorId,
            status == UserStatus.Disabled ? "USER_DISABLED" : "USER_REACTIVATED",
            "user",
            user.Id,
            new { status = previous },
            new { status }));
    }

    private async Task<Dictionary<string, string>> ValidateUpdateStaffAsync(
        string userId,
        string? roleId,
        string? email,
        string? mobile,
        string? city,
        string? nationalId,
        string? inspectorType,
        bool hasCompensation,
        decimal? feeValueSar,
        UserStatus status,
        UserStatus currentStatus,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(roleId))
            errors["roleId"] = "الدور مطلوب.";
        else if (!PrototypeRoleResolver.IsCreatableStaffRoleId(roleId))
            errors["roleId"] = "الدور المحدد غير مدعوم.";
        else if (roleId == "field-inspector" && inspectorType is not ("employee" or "contractor"))
            errors["inspectorType"] = "نوع المعاين مطلوب.";

        if (hasCompensation && feeValueSar is null)
            errors["feeValueSar"] = "قيمة الأتعاب مطلوبة عند تفعيل التعويض.";

        if (status == UserStatus.Active && string.IsNullOrWhiteSpace(city))
            errors["city"] = "المدينة مطلوبة لتفعيل الحساب.";

        if (status == UserStatus.Active && currentStatus == UserStatus.PendingActivation)
        {
            errors["status"] = "الحساب بانتظار التفعيل — أصدر رمز تفعيل بدلاً من تغيير الحالة.";
        }

        if (!string.IsNullOrWhiteSpace(email)
            && await _db.Users.AsNoTracking().AnyAsync(
                candidate => candidate.Id != userId && candidate.Email == email,
                cancellationToken))
        {
            errors["email"] = "البريد الإلكتروني مستخدم مسبقاً.";
        }

        if (!string.IsNullOrWhiteSpace(mobile)
            && await _db.Users.AsNoTracking().AnyAsync(
                candidate => candidate.Id != userId && candidate.PhoneNumber == mobile,
                cancellationToken))
        {
            errors["mobile"] = "رقم الجوال مستخدم مسبقاً.";
        }

        if (!string.IsNullOrWhiteSpace(nationalId)
            && await _db.UserProfiles.AsNoTracking().AnyAsync(
                candidate => candidate.UserId != userId && candidate.NationalId == nationalId,
                cancellationToken))
        {
            errors["nationalId"] = "رقم الهوية مستخدم مسبقاً.";
        }

        return errors;
    }

 /// <summary>Guards shared by disabling through PATCH and through the delete endpoint.</summary>
    private static string? DisableRefusalReason(
        ApplicationUser user,
        string userId,
        string? requestingUserId)
    {
        if (!string.IsNullOrWhiteSpace(requestingUserId)
            && string.Equals(userId, requestingUserId, StringComparison.Ordinal))
        {
            return "لا يمكنك تعطيل حسابك الحالي.";
        }

        var email = (user.Email ?? "").Trim().ToLowerInvariant();
        var userName = (user.UserName ?? "").Trim().ToLowerInvariant();
        return email is "admin@local.dev" or "s.salhy@gmail.com"
               || userName is "sliman" or "admin"
            ? "لا يمكن تعطيل حساب المسؤول الأساسي."
            : null;
    }

    private static Dictionary<string, string> FormError(string message) =>
        new(StringComparer.Ordinal) { ["_form"] = message };

    private static string? ResolveOptional(string? requested, string? current) =>
        requested is null
            ? current
            : requested.Trim().Length == 0 ? null : requested.Trim();

    public async Task<(ActivationTicketDto? Ticket, string? Error)> IssueActivationTicketAsync(
        string userId,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (null, "المستخدم غير موجود.");

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null || string.IsNullOrWhiteSpace(user.UserName))
            return (null, "المستخدم غير موجود.");

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        AddAudit(_audit.Create(
            actorId,
            "USER_ACTIVATION_TICKET_ISSUED",
            "user",
            user.Id,
            null,
            new { issued = true }));
        await SaveIdentityAsync(cancellationToken);
        return (new ActivationTicketDto
        {
            UserName = user.UserName,
            Token = token,
            ExpiresAtUtc = _time.UtcNow().Add(_activationTokenOptions.Value.TokenLifespan),
        }, null);
    }

    public async Task<(bool Ok, string? Error)> ActivateAccountAsync(
        ActivateAccountRequest request,
        CancellationToken cancellationToken = default)
    {
 // One opaque message for every failure: unknown user, bad/expired ticket and weak
 // password must be indistinguishable to an unauthenticated caller.
        const string genericError = "رمز التفعيل غير صالح أو منتهي الصلاحية.";

        var userName = request.UserName?.Trim() ?? "";
        if (userName.Length == 0
            || string.IsNullOrEmpty(request.Token)
            || string.IsNullOrEmpty(request.NewPassword))
        {
            return (false, genericError);
        }

        var user = await _userManager.FindByNameAsync(userName)
            ?? await _userManager.FindByEmailAsync(userName);
        if (user is null)
            return (false, genericError);

        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);
        if (profile is not null
            && profile.Status is UserStatus.Disabled or UserStatus.Locked)
            return (false, genericError);

        var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
        {
 // Password-policy failures are the one case worth surfacing: the ticket already
 // proved possession, so the detail leaks nothing an attacker does not have.
            var policyOnly = result.Errors.All(e =>
                e.Code.StartsWith("Password", StringComparison.Ordinal));
            return (false, policyOnly
                ? string.Join(" ", result.Errors.Select(e => e.Description))
                : genericError);
        }

 // Redeeming a ticket clears any lockout left over from failed sign-in attempts.
        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetLockoutEndDateAsync(user, null);
        if (profile is not null && profile.Status == UserStatus.PendingActivation)
        {
            var beforeStatus = profile.Status;
            profile.Status = UserStatus.Active;
            profile.UpdatedAtUtc = _time.UtcNow();
            AddAudit(_audit.Create(
                user.Id,
                "USER_ACTIVATED",
                "user",
                user.Id,
                new { status = beforeStatus },
                new { status = profile.Status }));
            await SaveIdentityAsync(cancellationToken);
        }
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteStaffAsync(
        string userId,
        string? requestingUserId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (false, "معرّف المستخدم غير صالح.");

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return (false, "المستخدم غير موجود.");

        var refusal = DisableRefusalReason(user, userId, requestingUserId);
        if (refusal is not null)
            return (false, refusal);

        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        if (profile is null)
            return (false, "ملف المستخدم غير موجود.");

        var previousStatus = profile.Status;
        profile.Status = UserStatus.Disabled;
        profile.UpdatedAtUtc = _time.UtcNow();
        AddAudit(_audit.Create(
            requestingUserId ?? "system",
            "USER_DISABLED",
            "user",
            userId,
            new { status = previousStatus },
            new { status = UserStatus.Disabled }));
        var activeTokens = await _db.RefreshTokens
            .Where(token => token.UserId == userId && token.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var token in activeTokens)
        {
            token.RevokedAtUtc = _time.UtcNow();
            token.RevokedReason = "user-disabled";
        }

        await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue);
        await SaveIdentityAsync(cancellationToken);

        return (true, null);
    }

    private static Dictionary<string, string> ValidateCreateStaffRequest(CreateStaffUserRequest request)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(request.DisplayName))
            errors["displayName"] = "الاسم مطلوب.";
        if (string.IsNullOrWhiteSpace(request.Email))
            errors["email"] = "البريد الإلكتروني مطلوب.";
        else if (!IsValidEmail(request.Email.Trim()))
            errors["email"] = "صيغة البريد الإلكتروني غير صحيحة.";
        if (string.IsNullOrWhiteSpace(request.Mobile))
            errors["mobile"] = "رقم الجوال مطلوب.";
        else if (!Regex.IsMatch(NormalizeMobile(request.Mobile), @"^\+[1-9]\d{8,14}$"))
            errors["mobile"] = "صيغة رقم الجوال غير صحيحة.";
        if (string.IsNullOrWhiteSpace(request.City))
            errors["city"] = "المدينة مطلوبة.";
        if (string.IsNullOrWhiteSpace(request.NationalId))
            errors["nationalId"] = "رقم الهوية مطلوب.";
        else if (!Regex.IsMatch(request.NationalId.Trim(), @"^[12]\d{9}$"))
            errors["nationalId"] = "رقم الهوية يجب أن يتكون من 10 أرقام.";
        if (string.IsNullOrWhiteSpace(request.RoleId))
            errors["roleId"] = "الدور مطلوب.";
        else if (!PrototypeRoleResolver.IsCreatableStaffRoleId(request.RoleId))
            errors["roleId"] = "الدور المحدد غير مدعوم.";
        else if (request.RoleId.Trim() == "field-inspector"
                 && request.InspectorType?.Trim().ToLowerInvariant()
                     is not ("employee" or "contractor"))
            errors["inspectorType"] = "نوع المعاين مطلوب.";
        if (request.FeeValueSar is < 0)
            errors["feeValueSar"] = "قيمة الأتعاب لا يمكن أن تكون سالبة.";
        if (request.HasCompensation == true && request.FeeValueSar is null)
            errors["feeValueSar"] = "قيمة الأتعاب مطلوبة عند تفعيل التعويض.";
        if (!string.IsNullOrWhiteSpace(request.Iban)
            && !Regex.IsMatch(request.Iban.Trim().Replace(" ", ""), @"^SA\d{22}$",
                RegexOptions.IgnoreCase))
            errors["iban"] = "صيغة الآيبان السعودي غير صحيحة.";

        return errors;
    }

    private static bool IsValidEmail(string email) => Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");

    private static string NormalizeMobile(string mobile)
    {
        var digits = Regex.Replace(mobile, @"\D", "");
        if (digits.StartsWith("00966", StringComparison.Ordinal))
            digits = digits[2..];
        if (digits.StartsWith("966", StringComparison.Ordinal))
            return $"+{digits}";
        if (digits.StartsWith("05", StringComparison.Ordinal) && digits.Length == 10)
            return $"+966{digits[1..]}";
        if (digits.StartsWith('5') && digits.Length == 9)
            return $"+966{digits}";
        return $"+{digits}";
    }

    private static string? Clean(string? value) => Texts.NullIfBlank(value);

    private async Task<string> AllocateUniqueUserNameAsync(
        string normalizedEmail,
        CancellationToken cancellationToken)
    {
        var baseName = DeriveUserNameFromEmail(normalizedEmail);
        var candidate = baseName;
        var suffix = 2;

        while (await _db.Users.AsNoTracking().AnyAsync(u => u.UserName == candidate, cancellationToken))
        {
            candidate = $"{baseName}-{suffix}";
            suffix++;
        }

        return candidate;
    }

    private static string DeriveUserNameFromEmail(string normalizedEmail)
    {
        var local = normalizedEmail.Split('@')[0].Trim().ToLowerInvariant();
        var sanitized = Regex.Replace(local, @"[^a-z0-9._-]", "_");
        sanitized = sanitized.Trim('_', '.', '-');
        if (string.IsNullOrWhiteSpace(sanitized))
            sanitized = "user";
        return sanitized.Length > 50 ? sanitized[..50] : sanitized;
    }

    private static string BuildDistributionAssigneeId(string roleId, string userName)
    {
        var prefix = roleId switch
        {
            "cdo" => "cdo",
            "general-manager" => "gm",
            "section-supervisor" => "ss",
            "case-specialist" => "cs",
            "government-reviewer" => "gov",
            "real-estate-appraiser" => "val",
            "field-inspector" => "fi",
            "financial-officer" => "fo",
            _ => "usr",
        };

        var slug = Regex.Replace(userName.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(slug))
            slug = "user";

        return $"{prefix}-{slug}";
    }

    private sealed record StaffRoleDefaults(
        string PermissionLevel,
        string EmploymentType,
        string Department,
        string? Section,
        ContractType ContractType,
        IReadOnlyList<string> IdentityRoles)
    {
        public static StaffRoleDefaults? TryFor(string roleId) =>
            PrototypeRoleResolver.IsCreatableStaffRoleId(roleId) ? For(roleId) : null;

        public static StaffRoleDefaults For(string roleId) =>
            roleId switch
            {
                "cdo" => new(
                    "cdo",
                    "دوام كامل",
                    "الإدارة التنفيذية",
                    null,
                    ContractType.Internal,
                    [OrgRoles.Cdo, DepartmentRoles.Hr]),
                "general-manager" => new(
                    "مدير",
                    "دوام كامل",
                    "إدارة التقييم العقاري",
                    null,
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "section-supervisor" => new(
                    "مشرف",
                    "دوام كامل",
                    SupervisingDepartments.CaseStudy,
                    "قسم دراسة الحالة",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Supervisor"]),
                "case-specialist" => new(
                    "محرر",
                    "دوام كامل",
                    SupervisingDepartments.CaseStudy,
                    "قسم دراسة الحالة",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "government-reviewer" => new(
                    "محرر",
                    "دوام كامل",
                    SupervisingDepartments.CaseStudy,
                    "قسم دراسة الحالة",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "real-estate-appraiser" => new(
                    "محرر",
                    "دوام كامل",
                    SupervisingDepartments.Valuation,
                    "قسم تقييم الأفراد",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "field-inspector" => new(
                    "محرر",
                    "دوام كامل",
                    SupervisingDepartments.Valuation,
                    "قسم تقييم الأفراد",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "financial-officer" => new(
                    "محرر",
                    "دوام كامل",
                    SupervisingDepartments.Finance,
                    "قسم المحاسبة",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "engineering-office" => new(
                    "مقدم خدمة",
                    "متعاقد",
                    SupervisingDepartments.External,
                    null,
                    ContractType.ServiceProvider,
                    [DepartmentRoles.Proc]),
                _ => throw new ArgumentOutOfRangeException(nameof(roleId), roleId, null),
            };
    }

    private void AddAudit(AuditLog entry)
    {
        if (_auditAppend is not null)
            _pendingRemoteAudit.Add(entry);
        else
            _db.AuditLogs.Add(entry);
    }

    private async Task SaveIdentityAsync(CancellationToken cancellationToken)
    {
        await _db.SaveChangesAsync(cancellationToken);
        if (_auditAppend is not null && _pendingRemoteAudit.Count > 0)
        {
            foreach (var entry in _pendingRemoteAudit)
                await _auditAppend.AppendAsync(entry, cancellationToken);
            _pendingRemoteAudit.Clear();
        }
    }
}
