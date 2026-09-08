using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class StaffProfileRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 2, 8, 0, 0, DateTimeKind.Utc);

    private static StaffIdentityUser User(
        string? email = "staff@example.test",
        string? phone = "+966500000099",
        string displayName = "موظف تجريبي") =>
        new("u-1", "staff", email, phone, displayName);

    private static StaffProfileState Stored(
        string? roleId = "case-specialist",
        UserStatus status = UserStatus.Active,
        string? iban = null,
        string? inspectorType = null,
        string? distributionAssigneeId = "cs-staff") => new()
        {
            UserId = "u-1",
            RoleId = roleId,
            JobTitle = "أخصائي دراسة حالة",
            Department = SupervisingDepartments.CaseStudy,
            City = "الرياض",
            NationalId = "1000000091",
            Iban = iban,
            InspectorType = inspectorType,
            HasCompensation = false,
            DistributionAssigneeId = distributionAssigneeId,
            Status = status,
            CreatedAtUtc = Now,
        };

    private static CreateStaffUserRequest CreateRequest(
        string roleId = "case-specialist",
        string? inspectorType = null,
        string? iban = null) => new()
        {
            DisplayName = " موظف ",
            Email = "New.Staff@example.test",
            Mobile = "0500000099",
            City = " الرياض ",
            NationalId = " 1000000091 ",
            RoleId = roleId,
            InspectorType = inspectorType,
            Iban = iban,
            TaxNumber = "  ",
        };

    // ---- registration ----

    [Fact]
    public void New_profile_is_active_with_the_role_defaults_and_trimmed_members()
    {
        var profile = StaffProfileRules.NewStaffProfile(
            CreateRequest(iban: "sa44 2000 0001 2345 6789 1234"),
            "u-1",
            "new.staff",
            "case-specialist",
            SupervisingDepartments.CaseStudy,
            "US-2026-0001",
            Now);

        Assert.Equal(UserStatus.Active, profile.Status);
        Assert.Equal("u-1", profile.UserId);
        Assert.Equal("الرياض", profile.City);
        Assert.Equal("1000000091", profile.NationalId);
        Assert.Equal("SA4420000001234567891234", profile.Iban);
        Assert.Null(profile.TaxNumber);
        Assert.Null(profile.InspectorType);
        Assert.Equal(RegistrationSource.Hr, profile.RegistrationSource);
        Assert.Equal(ContractType.Internal, profile.ContractType);
        Assert.Equal("cs-new-staff", profile.DistributionAssigneeId);
        Assert.Equal("US-2026-0001", profile.ReferenceNumber);
        Assert.Equal(Now, profile.CreatedAtUtc);
        Assert.False(profile.HasCompensation);
        Assert.Null(profile.FeeValueSar);
    }

    [Fact]
    public void Engineering_office_registers_through_procurement_and_field_inspector_keeps_its_type()
    {
        var office = StaffProfileRules.NewStaffProfile(
            CreateRequest("engineering-office"), "u-1", "eo", "engineering-office", null, null, Now);
        var inspector = StaffProfileRules.NewStaffProfile(
            CreateRequest("field-inspector", " Contractor "),
            "u-2", "fi", "field-inspector", null, null, Now);

        Assert.Equal(RegistrationSource.Proc, office.RegistrationSource);
        Assert.Equal(ContractType.ServiceProvider, office.ContractType);
        Assert.Equal("contractor", inspector.InspectorType);
        Assert.Equal(RegistrationSource.Hr, inspector.RegistrationSource);
    }

    // ---- edit resolution ----

    [Fact]
    public void Absent_members_keep_the_stored_values_and_present_ones_are_normalized()
    {
        var target = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { Email = " Other@Example.TEST ", Mobile = "0512345678" },
            User(),
            Stored());

        Assert.Equal("case-specialist", target.RoleId);
        Assert.Equal("موظف تجريبي", target.DisplayName);
        Assert.Equal("other@example.test", target.Email);
        Assert.Equal("+966512345678", target.Mobile);
        Assert.Equal("الرياض", target.City);
        Assert.Equal(UserStatus.Active, target.Status);
        Assert.False(StaffProfileRules.MobileRejected(
            new UpdateStaffUserRequest { Mobile = "0512345678" }, target));
    }

    [Fact]
    public void A_non_saudi_mobile_is_rejected_rather_than_stored()
    {
        var request = new UpdateStaffUserRequest { Mobile = "+1 555 0100" };
        var target = StaffProfileRules.ResolveUpdateTarget(request, User(), Stored());

        Assert.Null(target.Mobile);
        Assert.True(StaffProfileRules.MobileRejected(request, target));
    }

    [Fact]
    public void An_empty_string_clears_an_optional_member_and_iban_is_normalized()
    {
        var target = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { Iban = " sa44 2000 0001 2345 6789 1234 ", TaxNumber = "" },
            User(),
            Stored(iban: "SA0000000000000000000000"));

        Assert.Equal("SA4420000001234567891234", target.Iban);
        Assert.Null(target.TaxNumber);
    }

    [Fact]
    public void Switching_away_from_field_inspector_drops_the_inspector_type_and_compensation_gates_the_fee()
    {
        var stored = Stored("field-inspector", inspectorType: "contractor");

        var moved = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { RoleId = "case-specialist", FeeValueSar = 500m },
            User(),
            stored);
        var paid = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { HasCompensation = true, FeeValueSar = 500m },
            User(),
            stored);

        Assert.Null(moved.InspectorType);
        Assert.Null(moved.FeeValueSar);
        Assert.Equal("contractor", paid.InspectorType);
        Assert.Equal(500m, paid.FeeValueSar);
    }

    // ---- validation ----

    [Theory]
    [InlineData("", "roleId", "الدور مطلوب.")]
    [InlineData("astronaut", "roleId", "الدور المحدد غير مدعوم.")]
    [InlineData("field-inspector", "inspectorType", "نوع المعاين مطلوب.")]
    public void Validation_rejects_a_missing_unsupported_or_untyped_role(
        string roleId,
        string field,
        string message)
    {
        var target = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { RoleId = roleId },
            User(),
            Stored());

        var errors = StaffProfileRules.ValidateUpdateTarget(target, UserStatus.Active);

        Assert.Equal(message, errors[field]);
    }

    [Fact]
    public void Validation_requires_a_fee_when_compensated_and_a_city_when_activating()
    {
        var target = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { HasCompensation = true, City = "" },
            User(),
            Stored());

        var errors = StaffProfileRules.ValidateUpdateTarget(target, UserStatus.Active);

        Assert.Equal("قيمة الأتعاب مطلوبة عند تفعيل التعويض.", errors["feeValueSar"]);
        Assert.Equal("المدينة مطلوبة لتفعيل الحساب.", errors["city"]);
    }

    [Fact]
    public void A_legacy_pending_account_can_be_forced_active_by_a_status_edit()
    {
        var target = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { Status = UserStatus.Active },
            User(),
            Stored(status: UserStatus.PendingActivation));

        var errors = StaffProfileRules.ValidateUpdateTarget(target, UserStatus.PendingActivation);

        Assert.Empty(errors);
        Assert.Empty(StaffProfileRules.ValidateUpdateTarget(
            StaffProfileRules.ResolveUpdateTarget(new UpdateStaffUserRequest(), User(), Stored()),
            UserStatus.Active));
    }

    // ---- audit changes ----

    [Fact]
    public void Tracked_changes_hold_only_the_edited_members_and_audit_the_iban_by_presence()
    {
        var user = User();
        var stored = Stored();
        var target = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { City = "جدة", Iban = "SA4420000001234567891234" },
            user,
            stored);

        var changes = StaffProfileRules.TrackedChanges(user, stored, target);

        Assert.Equal(new[] { "city", "iban" }, changes.Keys);
        Assert.Equal("الرياض", changes["city"].Before);
        Assert.Equal("جدة", changes["city"].After);
        Assert.Equal("unset", changes["iban"].Before);
        Assert.Equal("set", changes["iban"].After);
        Assert.False(StaffProfileRules.IdentityChanged(user, target));
        Assert.Equal("جدة", StaffProfileRules.ApplyEdits(stored, target).City);
    }

    [Fact]
    public void Identity_changes_are_detected_and_a_no_op_edit_tracks_nothing()
    {
        var user = User();
        var stored = Stored();
        var mobileEdit = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { Mobile = "0512345678" }, user, stored);
        var nameEdit = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { DisplayName = "اسم جديد" }, user, stored);
        var noOp = StaffProfileRules.ResolveUpdateTarget(
            new UpdateStaffUserRequest { City = "الرياض" }, user, stored);

        Assert.True(StaffProfileRules.MobileChanged(user, mobileEdit));
        Assert.True(StaffProfileRules.IdentityChanged(user, mobileEdit));
        Assert.False(StaffProfileRules.MobileChanged(user, nameEdit));
        Assert.True(StaffProfileRules.IdentityChanged(user, nameEdit));
        Assert.Empty(StaffProfileRules.TrackedChanges(user, stored, noOp));
    }

    // ---- role change ----

    [Fact]
    public void Role_defaults_rederive_the_title_and_department_but_keep_the_assignee_id()
    {
        var profile = StaffProfileRules.ApplyRoleDefaults(
            Stored(), "section-supervisor", SupervisingDepartments.Valuation, "staff");

        Assert.Equal("section-supervisor", profile.RoleId);
        Assert.Equal(StaffRoleCatalog.JobTitleForRoleId("section-supervisor"), profile.JobTitle);
        Assert.Equal("مشرف", profile.PermissionLevel);
        Assert.Equal(SupervisingDepartments.Valuation, profile.Department);
        Assert.Equal("cs-staff", profile.DistributionAssigneeId);
    }

    [Fact]
    public void A_supervisor_without_a_selectable_department_keeps_the_stored_one_and_others_derive()
    {
        var supervisor = StaffProfileRules.ApplyRoleDefaults(
            Stored(distributionAssigneeId: null), "section-supervisor", null, "staff");
        var financial = StaffProfileRules.ApplyRoleDefaults(
            Stored(), "financial-officer", SupervisingDepartments.Valuation, null);

        Assert.Equal(SupervisingDepartments.CaseStudy, supervisor.Department);
        Assert.Equal("ss-staff", supervisor.DistributionAssigneeId);
        Assert.Equal(SupervisingDepartments.Finance, financial.Department);
    }

    [Fact]
    public void Role_membership_diff_drops_the_old_seats_and_retired_roles_and_adds_the_missing_ones()
    {
        var (stale, missing) = StaffProfileRules.RoleMembershipDiff(
            "case-specialist",
            "section-supervisor",
            ["Editor", "HR"]);

        Assert.Equal(new[] { "Editor", "HR" }, stale);
        Assert.Equal(new[] { "Supervisor" }, missing);

        var (noStale, alreadyThere) = StaffProfileRules.RoleMembershipDiff(
            null,
            "case-specialist",
            ["Editor"]);
        Assert.Empty(noStale);
        Assert.Empty(alreadyThere);
    }

    // ---- activation ----

    [Fact]
    public void Activation_is_blocked_for_disabled_or_locked_profiles_only()
    {
        Assert.True(StaffProfileRules.ProfileBlocksActivation(Stored(status: UserStatus.Disabled)));
        Assert.True(StaffProfileRules.ProfileBlocksActivation(Stored(status: UserStatus.Locked)));
        Assert.False(StaffProfileRules.ProfileBlocksActivation(Stored(status: UserStatus.PendingActivation)));
        Assert.False(StaffProfileRules.ProfileBlocksActivation(null));
    }

    [Fact]
    public void Only_pure_password_policy_failures_surface_their_detail()
    {
        var policy = StaffProfileRules.ActivationFailureMessage(
        [
            new StaffIdentityError("PasswordTooShort", "قصيرة"),
            new StaffIdentityError("PasswordRequiresDigit", "بدون رقم"),
        ]);
        var mixed = StaffProfileRules.ActivationFailureMessage(
        [
            new StaffIdentityError("PasswordTooShort", "قصيرة"),
            new StaffIdentityError("InvalidToken", "رمز"),
        ]);

        Assert.Equal("قصيرة بدون رقم", policy);
        Assert.Equal("رمز التفعيل غير صالح أو منتهي الصلاحية.", mixed);
        Assert.Equal(StaffProfileRules.ActivationGenericError, mixed);
    }
}
