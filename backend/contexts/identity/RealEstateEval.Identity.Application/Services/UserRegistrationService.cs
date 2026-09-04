using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Application.Rules;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Application.Services;

/// <summary>
/// Staff registration use case: create a password-less account, edit it, issue and redeem the
/// activation ticket, unlock, and soft-disable. Persistence goes through
/// <see cref="IStaffRegistrationRepository"/> and ASP.NET Identity through
/// <see cref="IStaffIdentityStore"/>, so this file holds rules only — no EF and no
/// <c>UserManager</c> (solid-scorecard finding 1).
/// </summary>
public partial class UserRegistrationService : IUserRegistrationService
{
    private readonly IStaffRegistrationRepository _repo;
    private readonly IStaffIdentityStore _accounts;
    private readonly IAuditLogAppend? _auditAppend;
    private readonly List<AuditLog> _pendingRemoteAudit = [];
    private readonly IAuditLogWriter _audit;
    private readonly IAuthSessionService _sessions;
    private readonly TimeProvider _time;

    public UserRegistrationService(
        IStaffRegistrationRepository repository,
        IStaffIdentityStore accounts,
        IAuditLogWriter audit,
        IAuthSessionService sessions,
        IAuditLogAppend? auditAppend = null,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _repo = repository;
        _accounts = accounts;
        _auditAppend = auditAppend;
        _audit = audit;
        _sessions = sessions;
    }

    public async Task<int> DeleteAllRegisteredAsync(
        CancellationToken cancellationToken = default)
    {
        const string protectedEmail = "admin@local.dev";

        var userIds = await _repo.ListProfiledUserIdsAsync(cancellationToken);

        var deleted = 0;
        foreach (var userId in userIds)
        {
            var user = await _accounts.FindByIdAsync(userId, cancellationToken);
            if (user is null)
                continue;

            var email = (user.Email ?? "").Trim().ToLowerInvariant();
            if (email == protectedEmail)
                continue;

            var roles = await _accounts.GetRolesAsync(userId, cancellationToken);
            if (roles.Any(OrgRoles.IsOrgRole))
                continue;

            var errors = await _accounts.DeleteAsync(userId, cancellationToken);
            if (errors.Count > 0)
            {
                throw new InvalidOperationException(
                    "Failed to delete user " + userId + ": "
                    + string.Join("; ", errors.Select(e => e.Description)));
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
        var jobTitle = StaffRoleCatalog.JobTitleForRoleId(roleId)!;
        var defaults = StaffRoleDefaults.For(roleId);
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        // The above verification within ValidateCreateStaffRequest ensures a valid Saudi mobile.
        var normalizedMobile = StaffUserRules.NormalizeMobile(request.Mobile)!;
        var displayName = request.DisplayName.Trim();
        var nationalId = request.NationalId.Trim();

        var existingEmail = await _accounts.FindByEmailAsync(normalizedEmail, cancellationToken);
        if (existingEmail is not null)
        {
            return (null, new Dictionary<string, string>
            {
                ["email"] = "البريد الإلكتروني مستخدم مسبقاً.",
            });
        }

        if (await _repo.PhoneNumberInUseAsync(normalizedMobile, null, cancellationToken))
        {
            return (null, new Dictionary<string, string>
            {
                ["mobile"] = "رقم الجوال مستخدم مسبقاً.",
            });
        }

        if (await _repo.NationalIdInUseAsync(nationalId, null, cancellationToken))
        {
            return (null, new Dictionary<string, string>
            {
                ["nationalId"] = "رقم الهوية مستخدم مسبقاً.",
            });
        }

        await using var transaction = await _repo.BeginTransactionAsync(cancellationToken);
        var userName = await AllocateUniqueUserNameAsync(normalizedEmail, cancellationToken);

 // Deliberately password-less: the account cannot sign in until its holder
 // redeems an activation ticket, so no credential ever crosses the API boundary.
        var (user, createErrors) = await _accounts.CreateAsync(
            new NewStaffIdentityUser(userName, normalizedEmail, displayName, normalizedMobile),
            cancellationToken);
        if (user is null)
        {
            return (null, new Dictionary<string, string>
            {
                ["_form"] = string.Join(" ", createErrors.Select(e => e.Description)),
            });
        }

        foreach (var identityRole in defaults.IdentityRoles.Distinct())
        {
            var roleErrors = await _accounts.AddToRoleAsync(user.Id, identityRole, cancellationToken);
            if (roleErrors.Count > 0)
            {
                return (null, new Dictionary<string, string>
                {
                    ["_form"] = string.Join(" ", roleErrors.Select(e => e.Description)),
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

 // Numbering session (bit lines 2 and 5): The user reference number is assigned upon registration.
        var (userReference, userReferenceError) =
            await _repo.AllocateUserReferenceAsync(_time.UtcNow(), cancellationToken);
        if (userReferenceError is not null)
        {
            return (null, new Dictionary<string, string> { ["_form"] = userReferenceError });
        }

        var profile = new StaffProfileState
        {
            UserId = user.Id,
            RegistrationSource = roleId == "engineering-office"
                ? RegistrationSource.Proc
                : RegistrationSource.Hr,
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
            ReferenceNumber = userReference,
            CreatedAtUtc = _time.UtcNow(),
        };

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
        var roleId = request.RoleId is null ? stored.RoleId : request.RoleId.Trim();
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
        var city = request.City is null ? stored.City : request.City.Trim();
        var nationalId = request.NationalId is null
            ? stored.NationalId
            : request.NationalId.Trim();
        var inspectorType = roleId == "field-inspector"
            ? StaffUserRules.ResolveOptional(request.InspectorType, stored.InspectorType)?.ToLowerInvariant()
            : null;
        var hasCompensation = request.HasCompensation ?? stored.HasCompensation;
        var feeValueSar = hasCompensation ? request.FeeValueSar ?? stored.FeeValueSar : null;
        var iban = StaffUserRules.ResolveOptional(request.Iban, stored.Iban)?.Replace(" ", "").ToUpperInvariant();
        var status = request.Status ?? stored.Status;

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
            stored.Status,
            cancellationToken);
        if (errors.Count > 0)
            return (null, errors);

        if (status != stored.Status && status == UserStatus.Disabled)
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

        var changes = new Dictionary<string, AuditValueChange>(StringComparer.Ordinal);

        void Track(string field, object? before, object? after)
        {
            if (Equals(before, after)) return;
            changes[field] = new AuditValueChange(before, after);
        }

        Track("displayName", user.DisplayName, displayName);
        Track("email", user.Email, email);
        Track("mobile", user.PhoneNumber, mobile);
        Track("city", stored.City, city);
        Track("nationalId", stored.NationalId, nationalId);
        Track("inspectorType", stored.InspectorType, inspectorType);
        Track("hasCompensation", stored.HasCompensation, hasCompensation);
        Track("feeValueSar", stored.FeeValueSar, feeValueSar);
 // Billing identifiers are recorded as presence only: the audit trail must prove that
 // an IBAN changed without storing the account number itself.
        Track("iban", stored.Iban is null ? "unset" : "set", iban is null ? "unset" : "set");

        var mobileChanged = !string.Equals(user.PhoneNumber, mobile, StringComparison.Ordinal);
        var identityChanged =
            !string.Equals(user.DisplayName, displayName, StringComparison.Ordinal)
            || !string.Equals(user.Email, email, StringComparison.Ordinal)
            || mobileChanged;

        var profile = stored with
        {
            City = city,
            NationalId = nationalId,
            InspectorType = inspectorType,
            HasCompensation = hasCompensation,
            FeeValueSar = feeValueSar,
            Iban = iban,
        };

        var avatarUrl = StaffUserRules.ResolveOptional(request.AvatarUrl, stored.AvatarUrl);
        Track("avatarUrl", stored.AvatarUrl, avatarUrl);
        profile = profile with { AvatarUrl = avatarUrl };

        var taxNumber = StaffUserRules.ResolveOptional(request.TaxNumber, stored.TaxNumber);
        Track("taxNumber", stored.TaxNumber, taxNumber);
        profile = profile with { TaxNumber = taxNumber };

        var commercialRegistration =
            StaffUserRules.ResolveOptional(request.CommercialRegistration, stored.CommercialRegistration);
        Track("commercialRegistration", stored.CommercialRegistration, commercialRegistration);
        profile = profile with { CommercialRegistration = commercialRegistration };

        var joinedAt = request.JoinedAt ?? stored.JoinedAt;
        Track("joinedAt", stored.JoinedAt, joinedAt);
        profile = profile with { JoinedAt = joinedAt };

        var departmentBefore = stored.Department;
        if (!string.Equals(stored.RoleId, roleId, StringComparison.Ordinal))
        {
            Track("roleId", stored.RoleId, roleId);
            profile = await ApplyRoleChangeAsync(
                user,
                profile,
                roleId!,
                request.Department,
                cancellationToken);
        }

        var (department, departmentError) = SupervisingDepartments.ResolveForStaff(
            roleId!,
            request.Department ?? profile.Department);
        if (departmentError is not null)
            return (null, new Dictionary<string, string> { ["department"] = departmentError });
        Track("department", departmentBefore, department);
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

        if (status != stored.Status)
        {
            profile = await ApplyStatusChangeAsync(
                user,
                profile,
                status,
                actorId,
                cancellationToken);
        }

        await _repo.ApplyProfileAsync(profile, cancellationToken);

        if (identityChanged)
        {
 // The account store refreshes the normalized email and saves every tracked change,
 // so the profile row and audit entry commit in the same round trip.
            var updateErrors = await _accounts.UpdateAsync(
                new StaffIdentityWrite(userId, displayName, email, mobile, mobileChanged),
                cancellationToken);
            if (updateErrors.Count > 0)
            {
                return (null, StaffUserRules.FormError(
                    string.Join(" ", updateErrors.Select(e => e.Description))));
            }
        }
        else
        {
            await SaveIdentityAsync(cancellationToken);
        }

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        return (await _repo.GetByUserIdAsync(userId, cancellationToken), null);
    }

    public async Task<(bool Ok, string? Error)> UnlockStaffAsync(
        string userId,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (false, "معرّف المستخدم غير صالح.");

        var user = await _accounts.FindByIdAsync(userId, cancellationToken);
        if (user is null)
            return (false, "المستخدم غير موجود.");

        var profile = await _repo.FindProfileAsync(userId, cancellationToken);
        if (profile?.Status == UserStatus.Disabled)
            return (false, "الحساب معطّل — أعد تفعيله قبل فك القفل.");

        await _accounts.ClearLockoutAsync(userId, cancellationToken);
        if (profile is not null && profile.Status == UserStatus.Locked)
        {
            await _repo.ApplyProfileAsync(
                profile with { Status = UserStatus.Active, UpdatedAtUtc = _time.UtcNow() },
                cancellationToken);
        }

        await AddAuditAsync(
            _audit.Create(
                actorId,
                "USER_UNLOCKED",
                "user",
                userId,
                new { locked = true },
                new { locked = false }),
            cancellationToken);
        await SaveIdentityAsync(cancellationToken);
        return (true, null);
    }

 /// <summary>
 /// Re-derives the job title, permission level, contract and identity roles for a new role.
 /// The distribution assignee id is deliberately preserved: it is referenced by existing
 /// work orders, so rewriting it would orphan live assignments.
 /// </summary>
    private async Task<StaffProfileState> ApplyRoleChangeAsync(
        StaffIdentityUser user,
        StaffProfileState profile,
        string roleId,
        string? requestedDepartment,
        CancellationToken cancellationToken)
    {
        var previous = profile.RoleId is null ? null : StaffRoleDefaults.TryFor(profile.RoleId);
        var defaults = StaffRoleDefaults.For(roleId);

        profile = profile with
        {
            RoleId = roleId,
            JobTitle = StaffRoleCatalog.JobTitleForRoleId(roleId)!,
            PermissionLevel = defaults.PermissionLevel,
            ContractType = defaults.ContractType,
            RegistrationSource = roleId == "engineering-office"
                ? RegistrationSource.Proc
                : RegistrationSource.Hr,
        };

        if (roleId == "section-supervisor")
        {
 // Keep the stored department unless the request supplies a selectable one; the
 // subsequent ResolveForStaff call rejects an invalid/missing selection.
            var (selected, _) = SupervisingDepartments.ResolveForStaff(roleId, requestedDepartment);
            if (selected is not null)
                profile = profile with { Department = selected };
        }
        else
        {
            profile = profile with { Department = SupervisingDepartments.DeriveForRole(roleId) };
        }

        if (profile.DistributionAssigneeId is null)
        {
            profile = profile with
            {
                DistributionAssigneeId =
                    StaffUserRules.BuildDistributionAssigneeId(roleId, user.UserName ?? ""),
            };
        }

        var currentRoles = await _accounts.GetRolesAsync(user.Id, cancellationToken);
        var target = defaults.IdentityRoles.Distinct().ToList();
        var removable = (previous?.IdentityRoles ?? [])
            .Concat(DepartmentRoles.RetiredIdentityRoles)
            .Distinct();
        var stale = removable
            .Where(role => !target.Contains(role) && currentRoles.Contains(role));
        foreach (var role in stale)
            await _accounts.RemoveFromRoleAsync(user.Id, role, cancellationToken);
        foreach (var role in target.Where(role => !currentRoles.Contains(role)))
            await _accounts.AddToRoleAsync(user.Id, role, cancellationToken);

        await _sessions.RevokeAllForUserAsync(user.Id, "roles-changed");
        return profile;
    }

    private async Task<StaffProfileState> ApplyStatusChangeAsync(
        StaffIdentityUser user,
        StaffProfileState profile,
        UserStatus status,
        string actorId,
        CancellationToken cancellationToken)
    {
        var previous = profile.Status;
        profile = profile with { Status = status, UpdatedAtUtc = _time.UtcNow() };

        if (status == UserStatus.Disabled)
        {
            await _repo.RevokeActiveRefreshTokensAsync(
                user.Id,
                _time.UtcNow(),
                "user-disabled",
                cancellationToken);
            await _accounts.LockOutIndefinitelyAsync(user.Id, cancellationToken);
        }
        else
        {
            await _accounts.ClearLockoutAsync(user.Id, cancellationToken);
        }

        await AddAuditAsync(
            _audit.Create(
                actorId,
                status == UserStatus.Disabled ? "USER_DISABLED" : "USER_REACTIVATED",
                "user",
                user.Id,
                new { status = previous },
                new { status }),
            cancellationToken);
        return profile;
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
        else if (!StaffRoleCatalog.IsCreatableStaffRoleId(roleId))
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

    public async Task<(ActivationTicketDto? Ticket, string? Error)> IssueActivationTicketAsync(
        string userId,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (null, "المستخدم غير موجود.");

        var user = await _accounts.FindByIdAsync(userId, cancellationToken);
        if (user is null || string.IsNullOrWhiteSpace(user.UserName))
            return (null, "المستخدم غير موجود.");

        var token = await _accounts.GenerateActivationTokenAsync(user.Id, cancellationToken);
        if (token is null)
            return (null, "المستخدم غير موجود.");

        await AddAuditAsync(
            _audit.Create(
                actorId,
                "USER_ACTIVATION_TICKET_ISSUED",
                "user",
                user.Id,
                null,
                new { issued = true }),
            cancellationToken);
        await SaveIdentityAsync(cancellationToken);
        return (new ActivationTicketDto
        {
            UserName = user.UserName,
            Token = token,
            ExpiresAtUtc = _time.UtcNow().Add(_accounts.ActivationTokenLifespan),
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

        var user = await _accounts.FindByNameOrEmailAsync(userName, cancellationToken);
        if (user is null)
            return (false, genericError);

        var profile = await _repo.FindProfileAsync(user.Id, cancellationToken);
        if (profile is not null
            && profile.Status is UserStatus.Disabled or UserStatus.Locked)
            return (false, genericError);

        var resetErrors = await _accounts.ResetPasswordAsync(
            user.Id,
            request.Token,
            request.NewPassword,
            cancellationToken);
        if (resetErrors.Count > 0)
        {
 // Password-policy failures are the one case worth surfacing: the ticket already
 // proved possession, so the detail leaks nothing an attacker does not have.
            var policyOnly = resetErrors.All(e =>
                e.Code.StartsWith("Password", StringComparison.Ordinal));
            return (false, policyOnly
                ? string.Join(" ", resetErrors.Select(e => e.Description))
                : genericError);
        }

 // Redeeming a ticket clears any lockout left over from failed sign-in attempts.
        await _accounts.ClearLockoutAsync(user.Id, cancellationToken);
        if (profile is not null && profile.Status == UserStatus.PendingActivation)
        {
            var beforeStatus = profile.Status;
            var activated = profile with
            {
                Status = UserStatus.Active,
                UpdatedAtUtc = _time.UtcNow(),
            };
            await _repo.ApplyProfileAsync(activated, cancellationToken);
            await AddAuditAsync(
                _audit.Create(
                    user.Id,
                    "USER_ACTIVATED",
                    "user",
                    user.Id,
                    new { status = beforeStatus },
                    new { status = activated.Status }),
                cancellationToken);
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

        var user = await _accounts.FindByIdAsync(userId, cancellationToken);
        if (user is null)
            return (false, "المستخدم غير موجود.");

        var refusal = StaffUserRules.DisableRefusalReason(
            user.Email,
            user.UserName,
            userId,
            requestingUserId);
        if (refusal is not null)
            return (false, refusal);

        var profile = await _repo.FindProfileAsync(userId, cancellationToken);
        if (profile is null)
            return (false, "ملف المستخدم غير موجود.");

        var previousStatus = profile.Status;
        await _repo.ApplyProfileAsync(
            profile with { Status = UserStatus.Disabled, UpdatedAtUtc = _time.UtcNow() },
            cancellationToken);
        await AddAuditAsync(
            _audit.Create(
                requestingUserId ?? "system",
                "USER_DISABLED",
                "user",
                userId,
                new { status = previousStatus },
                new { status = UserStatus.Disabled }),
            cancellationToken);
        await _repo.RevokeActiveRefreshTokensAsync(
            userId,
            _time.UtcNow(),
            "user-disabled",
            cancellationToken);

        await _accounts.LockOutIndefinitelyAsync(userId, cancellationToken);
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

        while (await _repo.UserNameExistsAsync(candidate, cancellationToken))
        {
            candidate = $"{baseName}-{suffix}";
            suffix++;
        }

        return candidate;
    }

    private async Task AddAuditAsync(AuditLog entry, CancellationToken cancellationToken)
    {
        if (_auditAppend is not null)
            _pendingRemoteAudit.Add(entry);
        else
            await _repo.AddAuditLogAsync(entry, cancellationToken);
    }

    private async Task SaveIdentityAsync(CancellationToken cancellationToken)
    {
        await _repo.SaveChangesAsync(cancellationToken);
        if (_auditAppend is not null && _pendingRemoteAudit.Count > 0)
        {
            foreach (var entry in _pendingRemoteAudit)
                await _auditAppend.AppendAsync(entry, cancellationToken);
            _pendingRemoteAudit.Clear();
        }
    }
}
