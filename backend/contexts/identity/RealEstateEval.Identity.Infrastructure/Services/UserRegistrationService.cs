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

public partial class UserRegistrationService : IUserRegistrationService
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
        var errors = StaffUserRules.ValidateCreateStaffRequest(request);
        if (errors.Count > 0)
            return (null, errors);

        var roleId = request.RoleId.Trim();
        var jobTitle = PrototypeRoleResolver.JobTitleForRoleId(roleId)!;
        var defaults = StaffRoleDefaults.For(roleId);
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        // The above verification within ValidateCreateStaffRequest ensures a valid Saudi mobile.
        var normalizedMobile = StaffUserRules.NormalizeMobile(request.Mobile)!;
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
            DistributionAssigneeId = StaffUserRules.BuildDistributionAssigneeId(roleId, userName),
            PermissionLevel = defaults.PermissionLevel,
            Status = UserStatus.PendingActivation,
            CreatedAtUtc = _time.UtcNow(),
        };
        if (roleId == "engineering-office")
            profile.RegistrationSource = RegistrationSource.Proc;

 // Numbering session (bit lines 2 and 5): The user reference number is assigned upon registration.
        var (userReference, userReferenceError) =
            await ReferenceSequenceAllocator.AllocateYearlyAsync(
                _db,
                DatabaseSchemas.Identity,
                ReferenceNumbering.User,
                _time.UtcNow(),
                cancellationToken);
        if (userReferenceError is not null)
        {
            return (null, new Dictionary<string, string> { ["_form"] = userReferenceError });
        }
        profile.ReferenceNumber = userReference;

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
            return (null, StaffUserRules.FormError("معرّف المستخدم غير صالح."));

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return (null, StaffUserRules.FormError("المستخدم غير موجود."));

        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        if (profile is null)
            return (null, StaffUserRules.FormError("ملف المستخدم غير موجود."));

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
            : StaffUserRules.NormalizeMobile(request.Mobile);
        // Q-3: A mobile phone entered in a format other than Saudi Arabia is rejected - a number that cannot be entered is not stored.
        if (request.Mobile is not null && mobile is null)
            return (null, StaffUserRules.FormError(
                "صيغة رقم الجوال السعودي غير صحيحة (05XXXXXXXX).", "mobile"));
        var city = request.City is null ? profile.City : request.City.Trim();
        var nationalId = request.NationalId is null
            ? profile.NationalId
            : request.NationalId.Trim();
        var inspectorType = roleId == "field-inspector"
            ? StaffUserRules.ResolveOptional(request.InspectorType, profile.InspectorType)?.ToLowerInvariant()
            : null;
        var hasCompensation = request.HasCompensation ?? profile.HasCompensation;
        var feeValueSar = hasCompensation ? request.FeeValueSar ?? profile.FeeValueSar : null;
        var iban = StaffUserRules.ResolveOptional(request.Iban, profile.Iban)?.Replace(" ", "").ToUpperInvariant();
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
            var refusal = StaffUserRules.DisableRefusalReason(user, userId, actorId);
            if (refusal is not null)
                return (null, StaffUserRules.FormError(refusal));
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

        var avatarUrl = StaffUserRules.ResolveOptional(request.AvatarUrl, profile.AvatarUrl);
        Track("avatarUrl", profile.AvatarUrl, avatarUrl);
        profile.AvatarUrl = avatarUrl;

        var taxNumber = StaffUserRules.ResolveOptional(request.TaxNumber, profile.TaxNumber);
        Track("taxNumber", profile.TaxNumber, taxNumber);
        profile.TaxNumber = taxNumber;

        var commercialRegistration =
            StaffUserRules.ResolveOptional(request.CommercialRegistration, profile.CommercialRegistration);
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
                return (null, StaffUserRules.FormError(
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
            profile.DistributionAssigneeId = StaffUserRules.BuildDistributionAssigneeId(roleId, user.UserName ?? "");

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

        var refusal = StaffUserRules.DisableRefusalReason(user, userId, requestingUserId);
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

    private static string? Clean(string? value) => Texts.NullIfBlank(value);

    private async Task<string> AllocateUniqueUserNameAsync(
        string normalizedEmail,
        CancellationToken cancellationToken)
    {
        var baseName = StaffUserRules.DeriveUserNameFromEmail(normalizedEmail);
        var candidate = baseName;
        var suffix = 2;

        while (await _db.Users.AsNoTracking().AnyAsync(u => u.UserName == candidate, cancellationToken))
        {
            candidate = $"{baseName}-{suffix}";
            suffix++;
        }

        return candidate;
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
