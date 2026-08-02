using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Validation;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class BoundaryRequestValidatorTests
{
    [Fact]
    public void Login_rejects_blank_credentials()
    {
        var result = new PasswordLoginRequestValidator().Validate(new PasswordLoginRequest());

        Assert.Contains(result.Errors, error => error.PropertyName == "username");
        Assert.Contains(result.Errors, error => error.PropertyName == "password");
    }

    [Fact]
    public void Activation_rejects_missing_ticket_and_password()
    {
        var result = new ActivateAccountRequestValidator().Validate(new ActivateAccountRequest());

        Assert.Contains(result.Errors, error => error.PropertyName == "userName");
        Assert.Contains(result.Errors, error => error.PropertyName == "token");
        Assert.Contains(result.Errors, error => error.PropertyName == "newPassword");
    }

    [Fact]
    public void Refresh_rejects_blank_token() =>
        Assert.False(new RefreshTokenRequestValidator()
            .Validate(new RefreshTokenRequest())
            .IsValid);

    [Fact]
    public void Staff_create_rejects_invalid_email()
    {
        var request = new CreateStaffUserRequest
        {
            DisplayName = "Test User",
            Email = "not-an-email",
            Mobile = "0500000011",
            City = "الرياض",
            NationalId = "1000000018",
            RoleId = "case-study-specialist",
        };

        var result = new CreateStaffUserRequestValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == "email");
    }

    [Fact]
    public void Staff_create_enforces_unified_identity_and_compensation_fields()
    {
        var request = new CreateStaffUserRequest
        {
            DisplayName = "Test Inspector",
            Email = "inspector@example.test",
            Mobile = "123",
            City = "الرياض",
            NationalId = "300",
            RoleId = "field-inspector",
            HasCompensation = true,
            Iban = "SA-invalid",
            AvatarUrl = "javascript:alert(1)",
        };

        var result = new CreateStaffUserRequestValidator().Validate(request);

        foreach (var property in new[]
                 {
                     "mobile",
                     "nationalId",
                     "inspectorType",
                     "feeValueSar",
                     "iban",
                     "avatarUrl",
                 })
        {
            Assert.Contains(result.Errors, error => error.PropertyName == property);
        }
    }

    [Fact]
    public void Staff_create_accepts_a_complete_unified_profile()
    {
        var request = new CreateStaffUserRequest
        {
            DisplayName = "Test Inspector",
            Email = "inspector@example.test",
            Mobile = "0500000011",
            City = "الرياض",
            NationalId = "1000000018",
            RoleId = "field-inspector",
            InspectorType = "contractor",
            HasCompensation = true,
            FeeValueSar = 450,
            Iban = "SA0380000000608010167519",
            AvatarUrl = "https://example.test/avatar.png",
        };

        Assert.True(new CreateStaffUserRequestValidator().Validate(request).IsValid);
    }

    [Fact]
    public void Staff_update_accepts_an_empty_body_because_every_member_is_optional() =>
        Assert.True(new UpdateStaffUserRequestValidator()
            .Validate(new UpdateStaffUserRequest())
            .IsValid);

    [Fact]
    public void Staff_update_still_checks_the_shape_of_the_members_it_receives()
    {
        var result = new UpdateStaffUserRequestValidator().Validate(new UpdateStaffUserRequest
        {
            DisplayName = "",
            Email = "not-an-email",
            Mobile = "12345",
            City = "",
            NationalId = "3000000001",
            Iban = "SA1",
            FeeValueSar = -1,
            AvatarUrl = "javascript:alert(1)",
            Status = UserStatus.PendingActivation,
        });

        Assert.Contains(result.Errors, error => error.PropertyName == "displayName");
        Assert.Contains(result.Errors, error => error.PropertyName == "email");
        Assert.Contains(result.Errors, error => error.PropertyName == "mobile");
        Assert.Contains(result.Errors, error => error.PropertyName == "city");
        Assert.Contains(result.Errors, error => error.PropertyName == "nationalId");
        Assert.Contains(result.Errors, error => error.PropertyName == "iban");
        Assert.Contains(result.Errors, error => error.PropertyName == "feeValueSar");
        Assert.Contains(result.Errors, error => error.PropertyName == "avatarUrl");
        Assert.Contains(result.Errors, error => error.PropertyName == "status");
    }

    [Fact]
    public void Staff_update_lets_an_empty_string_clear_an_optional_field()
    {
        var result = new UpdateStaffUserRequestValidator().Validate(new UpdateStaffUserRequest
        {
            Department = "",
            Iban = "",
            TaxNumber = "",
            InspectorType = "",
            AvatarUrl = "",
            Status = UserStatus.Disabled,
        });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Activation_ticket_rejects_blank_user_id() =>
        Assert.False(new IssueActivationTicketRequestValidator()
            .Validate(new IssueActivationTicketRequest())
            .IsValid);

    [Fact]
    public void Attachment_rejects_missing_metadata_and_content()
    {
        var result = new UploadAttachmentRequestValidator().Validate(new UploadAttachmentRequest());

        Assert.Contains(result.Errors, error => error.PropertyName == "scope");
        Assert.Contains(result.Errors, error => error.PropertyName == "scopeKey");
        Assert.Contains(result.Errors, error => error.PropertyName == "fileName");
        Assert.Contains(result.Errors, error => error.PropertyName == "contentBase64");
    }

    [Fact]
    public void Work_order_create_reuses_critical_write_rules()
    {
        var result = new CreateWorkOrderRequestValidator().Validate(new CreateWorkOrderRequest
        {
            AssignmentType = "invalid",
            PromulgationDate = "invalid",
            ExpectedPropertyCount = 0,
        });

        Assert.Contains(result.Errors, error => error.PropertyName == "poNumber");
        Assert.Contains(result.Errors, error => error.PropertyName == "assignmentType");
        Assert.Contains(result.Errors, error => error.PropertyName == "promulgationDate");
        Assert.Contains(result.Errors, error => error.PropertyName == "expectedPropertyCount");
    }
}
