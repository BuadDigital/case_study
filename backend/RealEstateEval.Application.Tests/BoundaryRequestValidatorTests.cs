using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Validation;

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
            RoleId = "case-study-specialist",
        };

        var result = new CreateStaffUserRequestValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == "email");
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
