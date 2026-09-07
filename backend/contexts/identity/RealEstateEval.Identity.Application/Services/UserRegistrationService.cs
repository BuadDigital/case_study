using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Application.Rules;

namespace RealEstateEval.Identity.Application.Services;

/// <summary>
/// Staff registration use case: create a password-less account, edit it, issue and redeem the
/// activation ticket, unlock, and soft-disable. Persistence goes through
/// <see cref="IStaffRegistrationRepository"/> and ASP.NET Identity through
/// <see cref="IStaffIdentityStore"/>, so this file holds rules only — no EF and no
/// <c>UserManager</c> (solid-scorecard finding 1). The activation ticket lives in
/// <c>UserRegistrationService.Activation.cs</c>, unlock/disable/bulk delete in
/// <c>UserRegistrationService.Lifecycle.cs</c>, and the reads in
/// <c>UserRegistrationService.Queries.cs</c>; storage-free decisions sit in
/// <see cref="StaffProfileRules"/>.
/// </summary>
public partial class UserRegistrationService : IUserRegistrationService
{
    private readonly IStaffRegistrationRepository _repo;
    private readonly IStaffIdentityStore _accounts;
    private readonly IAuditLogAppend _auditAppend;
    private readonly List<AuditLog> _pendingRemoteAudit = [];
    private readonly IAuditLogWriter _audit;
    private readonly IAuthSessionService _sessions;
    private readonly TimeProvider _time;

    public UserRegistrationService(
        IStaffRegistrationRepository repository,
        IStaffIdentityStore accounts,
        IAuditLogWriter audit,
        IAuthSessionService sessions,
        IAuditLogAppend auditAppend,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _repo = repository;
        _accounts = accounts;
        _auditAppend = auditAppend;
        _audit = audit;
        _sessions = sessions;
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
        var defaults = StaffRoleDefaults.For(roleId);
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        // The above verification within ValidateCreateStaffRequest ensures a valid Saudi mobile.
        var normalizedMobile = StaffUserRules.NormalizeMobile(request.Mobile)!;
        var displayName = request.DisplayName.Trim();
        var nationalId = request.NationalId.Trim();

        var existingEmail = await _accounts.FindByEmailAsync(normalizedEmail, cancellationToken);
        if (existingEmail is not null)
            return (null, StaffUserRules.FormError("البريد الإلكتروني مستخدم مسبقاً.", "email"));

        if (await _repo.PhoneNumberInUseAsync(normalizedMobile, null, cancellationToken))
            return (null, StaffUserRules.FormError("رقم الجوال مستخدم مسبقاً.", "mobile"));

        if (await _repo.NationalIdInUseAsync(nationalId, null, cancellationToken))
            return (null, StaffUserRules.FormError("رقم الهوية مستخدم مسبقاً.", "nationalId"));

        await using var transaction = await _repo.BeginTransactionAsync(cancellationToken);
        var userName = await AllocateUniqueUserNameAsync(normalizedEmail, cancellationToken);

        // Deliberately password-less: the account cannot sign in until its holder
        // redeems an activation ticket, so no credential ever crosses the API boundary.
        var (user, createErrors) = await _accounts.CreateAsync(
            new NewStaffIdentityUser(userName, normalizedEmail, displayName, normalizedMobile),
            cancellationToken);
        if (user is null)
            return (null, StaffUserRules.FormError(StaffProfileRules.Describe(createErrors)));

        foreach (var identityRole in defaults.IdentityRoles.Distinct())
        {
            var roleErrors = await _accounts.AddToRoleAsync(user.Id, identityRole, cancellationToken);
            if (roleErrors.Count > 0)
                return (null, StaffUserRules.FormError(StaffProfileRules.Describe(roleErrors)));
        }

        var (department, departmentError) = SupervisingDepartments.ResolveForStaff(
            roleId,
            request.Department);
        if (departmentError is not null)
            return (null, StaffUserRules.FormError(departmentError, "department"));

        // Numbering session (bit lines 2 and 5): The user reference number is assigned upon registration.
        var (userReference, userReferenceError) =
            await _repo.AllocateUserReferenceAsync(_time.UtcNow(), cancellationToken);
        if (userReferenceError is not null)
            return (null, StaffUserRules.FormError(userReferenceError));

        var profile = StaffProfileRules.NewStaffProfile(
            request,
            user.Id,
            userName,
            roleId,
            department,
            userReference,
            _time.UtcNow());

        await _repo.AddProfileAsync(profile, cancellationToken);
        await AddAuditAsync(
            _audit.Create(
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
                }),
            cancellationToken);
        await SaveIdentityAsync(cancellationToken);
        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        var dto = await _repo.GetByUserIdAsync(user.Id, cancellationToken);
        return (new CreateStaffUserResponseDto
        {
            User = dto!,
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

        var user = await _accounts.FindByIdAsync(userId, cancellationToken);
        if (user is null)
            return (null, StaffUserRules.FormError("المستخدم غير موجود."));

        var stored = await _repo.FindProfileAsync(userId, cancellationToken);
        if (stored is null)
            return (null, StaffUserRules.FormError("ملف المستخدم غير موجود."));

        // Resolve the target state first: an absent member keeps the stored value, and an
        // empty string clears an optional one.
        var target = StaffProfileRules.ResolveUpdateTarget(request, user, stored);
        // Q-3: A mobile phone entered in a format other than Saudi Arabia is rejected - a number that cannot be entered is not stored.
        if (StaffProfileRules.MobileRejected(request, target))
            return (null, StaffUserRules.FormError(
                "صيغة رقم الجوال السعودي غير صحيحة (05XXXXXXXX).", "mobile"));

        var errors = await ValidateUpdateStaffAsync(userId, target, stored.Status, cancellationToken);
        if (errors.Count > 0)
            return (null, errors);

        if (target.Status != stored.Status && target.Status == UserStatus.Disabled)
        {
            var refusal = StaffUserRules.DisableRefusalReason(
                user.Email,
                user.UserName,
                userId,
                actorId);
            if (refusal is not null)
                return (null, StaffUserRules.FormError(refusal));
        }

        await using var transaction = await _repo.BeginTransactionAsync(cancellationToken);

        var changes = StaffProfileRules.TrackedChanges(user, stored, target);
        var mobileChanged = StaffProfileRules.MobileChanged(user, target);
        var identityChanged = StaffProfileRules.IdentityChanged(user, target);
        var profile = StaffProfileRules.ApplyEdits(stored, target);

        var departmentBefore = stored.Department;
        if (!string.Equals(stored.RoleId, target.RoleId, StringComparison.Ordinal))
        {
            StaffProfileRules.Track(changes, "roleId", stored.RoleId, target.RoleId);
            profile = await ApplyRoleChangeAsync(
                user,
                profile,
                target.RoleId!,
                request.Department,
                cancellationToken);
        }

        var (department, departmentError) = SupervisingDepartments.ResolveForStaff(
            target.RoleId!,
            request.Department ?? profile.Department);
        if (departmentError is not null)
            return (null, StaffUserRules.FormError(departmentError, "department"));
        StaffProfileRules.Track(changes, "department", departmentBefore, department);
        profile = profile with { Department = department };

        if (changes.Count > 0)
        {
            profile = profile with { UpdatedAtUtc = _time.UtcNow() };
            await AddAuditAsync(
                _audit.CreateFromChanges(
                    actorId,
                    "USER_UPDATED",
                    "user",
                    userId,
                    changes),
                cancellationToken);
        }

        if (target.Status != stored.Status)
        {
            profile = await ApplyStatusChangeAsync(
                user,
                profile,
                target.Status,
                actorId,
                cancellationToken);
        }

        await _repo.ApplyProfileAsync(profile, cancellationToken);

        if (identityChanged)
        {
            // The account store refreshes the normalized email and saves every tracked change,
            // so the profile row and audit entry commit in the same round trip.
            var updateErrors = await _accounts.UpdateAsync(
                new StaffIdentityWrite(
                    userId,
                    target.DisplayName,
                    target.Email,
                    target.Mobile,
                    mobileChanged),
                cancellationToken);
            if (updateErrors.Count > 0)
                return (null, StaffUserRules.FormError(StaffProfileRules.Describe(updateErrors)));
        }
        else
        {
            await SaveIdentityAsync(cancellationToken);
        }

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        return (await _repo.GetByUserIdAsync(userId, cancellationToken), null);
    }

    /// <summary>
    /// Applies the new role's defaults (see <see cref="StaffProfileRules.ApplyRoleDefaults"/>),
    /// then syncs the identity-role membership and revokes the holder's sessions.
    /// </summary>
    private async Task<StaffProfileState> ApplyRoleChangeAsync(
        StaffIdentityUser user,
        StaffProfileState profile,
        string roleId,
        string? requestedDepartment,
        CancellationToken cancellationToken)
    {
        var previousRoleId = profile.RoleId;
        profile = StaffProfileRules.ApplyRoleDefaults(
            profile,
            roleId,
            requestedDepartment,
            user.UserName);

        var currentRoles = await _accounts.GetRolesAsync(user.Id, cancellationToken);
        var (stale, missing) = StaffProfileRules.RoleMembershipDiff(
            previousRoleId,
            roleId,
            currentRoles);
        foreach (var role in stale)
            await _accounts.RemoveFromRoleAsync(user.Id, role, cancellationToken);
        foreach (var role in missing)
            await _accounts.AddToRoleAsync(user.Id, role, cancellationToken);

        await _sessions.RevokeAllForUserAsync(user.Id, "roles-changed");
        return profile;
    }

    private async Task<Dictionary<string, string>> ValidateUpdateStaffAsync(
        string userId,
        StaffUpdateTarget target,
        UserStatus currentStatus,
        CancellationToken cancellationToken)
    {
        var errors = StaffProfileRules.ValidateUpdateTarget(target, currentStatus);
        var email = target.Email;
        var mobile = target.Mobile;
        var nationalId = target.NationalId;

        if (!string.IsNullOrWhiteSpace(email)
            && await _repo.EmailInUseAsync(email, userId, cancellationToken))
        {
            errors["email"] = "البريد الإلكتروني مستخدم مسبقاً.";
        }

        if (!string.IsNullOrWhiteSpace(mobile)
            && await _repo.PhoneNumberInUseAsync(mobile, userId, cancellationToken))
        {
            errors["mobile"] = "رقم الجوال مستخدم مسبقاً.";
        }

        if (!string.IsNullOrWhiteSpace(nationalId)
            && await _repo.NationalIdInUseAsync(nationalId, userId, cancellationToken))
        {
            errors["nationalId"] = "رقم الهوية مستخدم مسبقاً.";
        }

        return errors;
    }

    private async Task<string> AllocateUniqueUserNameAsync(
        string normalizedEmail,
        CancellationToken cancellationToken)
    {
        var baseName = StaffUserRules.DeriveUserNameFromEmail(normalizedEmail);
        var candidate = baseName;
        var suffix = 2;

        while (await _repo.UserNameExistsAsync(candidate, cancellationToken))
        {
            candidate = $"{baseName}-{suffix}";
            suffix++;
        }

        return candidate;
    }

    /// <summary>
    /// Audit rows are appended through the Platform-owned ledger after the identity write commits;
    /// the identity database holds no audit table of its own.
    /// </summary>
    private Task AddAuditAsync(AuditLog entry, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _pendingRemoteAudit.Add(entry);
        return Task.CompletedTask;
    }

    private async Task SaveIdentityAsync(CancellationToken cancellationToken)
    {
        await _repo.SaveChangesAsync(cancellationToken);
        foreach (var entry in _pendingRemoteAudit)
            await _auditAppend.AppendAsync(entry, cancellationToken);
        _pendingRemoteAudit.Clear();
    }
}
