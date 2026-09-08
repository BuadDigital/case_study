using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Application.Rules;

/// <summary>
/// The target state of one staff edit, resolved against the stored account and profile: an
/// absent request member keeps the stored value, and an empty string clears an optional one.
/// </summary>
public sealed record StaffUpdateTarget(
    string? RoleId,
    string DisplayName,
    string? Email,
    string? Mobile,
    string? City,
    string? NationalId,
    string? InspectorType,
    bool HasCompensation,
    decimal? FeeValueSar,
    string? Iban,
    string? AvatarUrl,
    string? TaxNumber,
    string? CommercialRegistration,
    DateOnly? JoinedAt,
    UserStatus Status);

/// <summary>
/// Staff-profile decisions that need no storage: the profile row a registration creates, how an
/// edit resolves against the stored state and which members it validates, the audit changes an
/// edit leaves, what a role change re-derives, and the messages an activation may surface.
/// </summary>
public static class StaffProfileRules
{
    /// <summary>
    /// One opaque message for every activation failure: unknown user, bad/expired ticket and
    /// weak password must be indistinguishable to an unauthenticated caller.
    /// </summary>
    public const string ActivationGenericError = "رمز التفعيل غير صالح أو منتهي الصلاحية.";

    public static RegistrationSource RegistrationSourceFor(string roleId) =>
        roleId == "engineering-office" ? RegistrationSource.Proc : RegistrationSource.Hr;

    public static string NormalizeIban(string iban) => iban.Replace(" ", "").ToUpperInvariant();

    /// <summary>Flattens identity-store failures the way the API reports them.</summary>
    public static string Describe(IReadOnlyList<StaffIdentityError> errors) =>
        string.Join(" ", errors.Select(e => e.Description));

    // ---- registration ----

    /// <summary>The active profile row of a freshly created, validated account (phone login).</summary>
    public static StaffProfileState NewStaffProfile(
        CreateStaffUserRequest request,
        string userId,
        string userName,
        string roleId,
        string? department,
        string? userReference,
        DateTime nowUtc)
    {
        var defaults = StaffRoleDefaults.For(roleId);
        return new StaffProfileState
        {
            UserId = userId,
            RegistrationSource = RegistrationSourceFor(roleId),
            ContractType = defaults.ContractType,
            RoleId = roleId,
            JobTitle = StaffRoleCatalog.JobTitleForRoleId(roleId)!,
            Department = department,
            City = request.City.Trim(),
            NationalId = request.NationalId.Trim(),
            AvatarUrl = Texts.NullIfBlank(request.AvatarUrl),
            InspectorType = roleId == "field-inspector"
                ? request.InspectorType!.Trim().ToLowerInvariant()
                : null,
            HasCompensation = request.HasCompensation ?? false,
            FeeValueSar = request.HasCompensation == true ? request.FeeValueSar : null,
            Iban = string.IsNullOrWhiteSpace(request.Iban) ? null : NormalizeIban(request.Iban),
            TaxNumber = Texts.NullIfBlank(request.TaxNumber),
            CommercialRegistration = Texts.NullIfBlank(request.CommercialRegistration),
            JoinedAt = request.JoinedAt,
            DistributionAssigneeId = StaffUserRules.BuildDistributionAssigneeId(roleId, userName),
            PermissionLevel = defaults.PermissionLevel,
            Status = UserStatus.Active,
            ReferenceNumber = userReference,
            CreatedAtUtc = nowUtc,
        };
    }

    // ---- edit resolution ----

    public static StaffUpdateTarget ResolveUpdateTarget(
        UpdateStaffUserRequest request,
        StaffIdentityUser user,
        StaffProfileState stored)
    {
        var roleId = request.RoleId is null ? stored.RoleId : request.RoleId.Trim();
        var hasCompensation = request.HasCompensation ?? stored.HasCompensation;
        return new StaffUpdateTarget(
            RoleId: roleId,
            DisplayName: request.DisplayName is null ? user.DisplayName : request.DisplayName.Trim(),
            Email: request.Email is null ? user.Email : request.Email.Trim().ToLowerInvariant(),
            Mobile: request.Mobile is null
                ? user.PhoneNumber
                : StaffUserRules.NormalizeMobile(request.Mobile),
            City: request.City is null ? stored.City : request.City.Trim(),
            NationalId: request.NationalId is null ? stored.NationalId : request.NationalId.Trim(),
            InspectorType: roleId == "field-inspector"
                ? StaffUserRules.ResolveOptional(request.InspectorType, stored.InspectorType)
                    ?.ToLowerInvariant()
                : null,
            HasCompensation: hasCompensation,
            FeeValueSar: hasCompensation ? request.FeeValueSar ?? stored.FeeValueSar : null,
            Iban: StaffUserRules.ResolveOptional(request.Iban, stored.Iban) is { } iban
                ? NormalizeIban(iban)
                : null,
            AvatarUrl: StaffUserRules.ResolveOptional(request.AvatarUrl, stored.AvatarUrl),
            TaxNumber: StaffUserRules.ResolveOptional(request.TaxNumber, stored.TaxNumber),
            CommercialRegistration: StaffUserRules.ResolveOptional(
                request.CommercialRegistration,
                stored.CommercialRegistration),
            JoinedAt: request.JoinedAt ?? stored.JoinedAt,
            Status: request.Status ?? stored.Status);
    }

    /// <summary>Q-3: a mobile entered in a non-Saudi format is rejected, never stored.</summary>
    public static bool MobileRejected(UpdateStaffUserRequest request, StaffUpdateTarget target) =>
        request.Mobile is not null && target.Mobile is null;

    /// <summary>The storage-free half of edit validation; uniqueness guards run in the service.</summary>
    public static Dictionary<string, string> ValidateUpdateTarget(
        StaffUpdateTarget target,
        UserStatus currentStatus)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(target.RoleId))
            errors["roleId"] = "الدور مطلوب.";
        else if (!StaffRoleCatalog.IsCreatableStaffRoleId(target.RoleId))
            errors["roleId"] = "الدور المحدد غير مدعوم.";
        else if (target.RoleId == "field-inspector"
                 && target.InspectorType is not ("employee" or "contractor"))
            errors["inspectorType"] = "نوع المعاين مطلوب.";

        if (target.HasCompensation && target.FeeValueSar is null)
            errors["feeValueSar"] = "قيمة الأتعاب مطلوبة عند تفعيل التعويض.";

        if (target.Status == UserStatus.Active && string.IsNullOrWhiteSpace(target.City))
            errors["city"] = "المدينة مطلوبة لتفعيل الحساب.";

        return errors;
    }

    public static bool MobileChanged(StaffIdentityUser user, StaffUpdateTarget target) =>
        !string.Equals(user.PhoneNumber, target.Mobile, StringComparison.Ordinal);

    public static bool IdentityChanged(StaffIdentityUser user, StaffUpdateTarget target) =>
        !string.Equals(user.DisplayName, target.DisplayName, StringComparison.Ordinal)
        || !string.Equals(user.Email, target.Email, StringComparison.Ordinal)
        || MobileChanged(user, target);

    /// <summary>
    /// The audit changes of the plain members. Billing identifiers are recorded as presence
    /// only: the trail must prove that an IBAN changed without storing the account number.
    /// </summary>
    public static Dictionary<string, AuditValueChange> TrackedChanges(
        StaffIdentityUser user,
        StaffProfileState stored,
        StaffUpdateTarget target)
    {
        var changes = new Dictionary<string, AuditValueChange>(StringComparer.Ordinal);
        Track(changes, "displayName", user.DisplayName, target.DisplayName);
        Track(changes, "email", user.Email, target.Email);
        Track(changes, "mobile", user.PhoneNumber, target.Mobile);
        Track(changes, "city", stored.City, target.City);
        Track(changes, "nationalId", stored.NationalId, target.NationalId);
        Track(changes, "inspectorType", stored.InspectorType, target.InspectorType);
        Track(changes, "hasCompensation", stored.HasCompensation, target.HasCompensation);
        Track(changes, "feeValueSar", stored.FeeValueSar, target.FeeValueSar);
        Track(changes, "iban", stored.Iban is null ? "unset" : "set", target.Iban is null ? "unset" : "set");
        Track(changes, "avatarUrl", stored.AvatarUrl, target.AvatarUrl);
        Track(changes, "taxNumber", stored.TaxNumber, target.TaxNumber);
        Track(changes, "commercialRegistration", stored.CommercialRegistration, target.CommercialRegistration);
        Track(changes, "joinedAt", stored.JoinedAt, target.JoinedAt);
        return changes;
    }

    public static void Track(
        Dictionary<string, AuditValueChange> changes,
        string field,
        object? before,
        object? after)
    {
        if (Equals(before, after)) return;
        changes[field] = new AuditValueChange(before, after);
    }

    /// <summary>The stored profile with every plain edited member applied.</summary>
    public static StaffProfileState ApplyEdits(StaffProfileState stored, StaffUpdateTarget target) =>
        stored with
        {
            City = target.City,
            NationalId = target.NationalId,
            InspectorType = target.InspectorType,
            HasCompensation = target.HasCompensation,
            FeeValueSar = target.FeeValueSar,
            Iban = target.Iban,
            AvatarUrl = target.AvatarUrl,
            TaxNumber = target.TaxNumber,
            CommercialRegistration = target.CommercialRegistration,
            JoinedAt = target.JoinedAt,
        };

    // ---- role change ----

    /// <summary>
    /// Re-derives the job title, permission level, contract, source and department for a new
    /// role. The distribution assignee id is deliberately preserved: it is referenced by existing
    /// work orders, so rewriting it would orphan live assignments.
    /// </summary>
    public static StaffProfileState ApplyRoleDefaults(
        StaffProfileState profile,
        string roleId,
        string? requestedDepartment,
        string? userName)
    {
        var defaults = StaffRoleDefaults.For(roleId);

        profile = profile with
        {
            RoleId = roleId,
            JobTitle = StaffRoleCatalog.JobTitleForRoleId(roleId)!,
            PermissionLevel = defaults.PermissionLevel,
            ContractType = defaults.ContractType,
            RegistrationSource = RegistrationSourceFor(roleId),
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
                    StaffUserRules.BuildDistributionAssigneeId(roleId, userName ?? ""),
            };
        }

        return profile;
    }

    /// <summary>
    /// Identity roles to drop and to add when moving from one product role to another: the
    /// previous role's seats and the retired department roles go, the new role's seats come.
    /// </summary>
    public static (IReadOnlyList<string> Stale, IReadOnlyList<string> Missing) RoleMembershipDiff(
        string? previousRoleId,
        string roleId,
        IReadOnlyList<string> currentRoles)
    {
        var previous = previousRoleId is null ? null : StaffRoleDefaults.TryFor(previousRoleId);
        var target = StaffRoleDefaults.For(roleId).IdentityRoles.Distinct().ToList();
        var removable = (previous?.IdentityRoles ?? [])
            .Concat(DepartmentRoles.RetiredIdentityRoles)
            .Distinct();
        var stale = removable
            .Where(role => !target.Contains(role) && currentRoles.Contains(role))
            .ToList();
        var missing = target.Where(role => !currentRoles.Contains(role)).ToList();
        return (stale, missing);
    }

    // ---- activation ----

    /// <summary>A disabled or locked profile may not redeem a ticket.</summary>
    public static bool ProfileBlocksActivation(StaffProfileState? profile) =>
        profile is not null
        && profile.Status is UserStatus.Disabled or UserStatus.Locked;

    /// <summary>
    /// Password-policy failures are the one case worth surfacing: the ticket already proved
    /// possession, so the detail leaks nothing an attacker does not have.
    /// </summary>
    public static string ActivationFailureMessage(IReadOnlyList<StaffIdentityError> resetErrors)
    {
        var policyOnly = resetErrors.All(e =>
            e.Code.StartsWith("Password", StringComparison.Ordinal));
        return policyOnly ? Describe(resetErrors) : ActivationGenericError;
    }
}
