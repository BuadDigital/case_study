using System.Net.Mail;
using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Validation;

public sealed class PasswordLoginRequestValidator : AbstractValidator<PasswordLoginRequest>
{
    public PasswordLoginRequestValidator()
    {
        RuleFor(x => x.Username).NotEmpty().MinimumLength(2).MaximumLength(64)
            .OverridePropertyName("username");
        RuleFor(x => x.Password).NotEmpty().MaximumLength(256)
            .OverridePropertyName("password");
    }
}

public sealed class UsernameLoginRequestValidator : AbstractValidator<UsernameLoginRequest>
{
    public UsernameLoginRequestValidator() =>
        RuleFor(x => x.Username).NotEmpty().MinimumLength(2).MaximumLength(64)
            .OverridePropertyName("username");
}

public sealed class RefreshTokenRequestValidator : AbstractValidator<RefreshTokenRequest>
{
    public RefreshTokenRequestValidator() =>
        RuleFor(x => x.RefreshToken).NotEmpty().MaximumLength(256)
            .OverridePropertyName("refreshToken");
}

public sealed class ActivateAccountRequestValidator : AbstractValidator<ActivateAccountRequest>
{
    public ActivateAccountRequestValidator()
    {
        RuleFor(x => x.UserName).NotEmpty().MaximumLength(256)
            .OverridePropertyName("userName");
        RuleFor(x => x.Token).NotEmpty().MaximumLength(4096)
            .OverridePropertyName("token");
        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .MinimumLength(12)
            .MaximumLength(256)
            .Matches("[A-Z]").WithMessage("يجب أن تحتوي كلمة المرور على حرف إنجليزي كبير.")
            .Matches("[a-z]").WithMessage("يجب أن تحتوي كلمة المرور على حرف إنجليزي صغير.")
            .Matches("[0-9]").WithMessage("يجب أن تحتوي كلمة المرور على رقم.")
            .Matches("[^a-zA-Z0-9]").WithMessage("يجب أن تحتوي كلمة المرور على رمز.")
            .OverridePropertyName("newPassword");
    }
}

public sealed class CreateStaffUserRequestValidator : AbstractValidator<CreateStaffUserRequest>
{
    public CreateStaffUserRequestValidator()
    {
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(256)
            .OverridePropertyName("displayName");
        RuleFor(x => x.Email).NotEmpty().MaximumLength(256).Must(BeValidEmail)
            .WithMessage("صيغة البريد الإلكتروني غير صالحة.")
            .OverridePropertyName("email");
        RuleFor(x => x.RoleId).NotEmpty().MaximumLength(128)
            .OverridePropertyName("roleId");
        RuleFor(x => x.EmployeeNumber).MaximumLength(128)
            .OverridePropertyName("employeeNumber");
        RuleFor(x => x.NationalId).MaximumLength(128)
            .OverridePropertyName("nationalId");
    }

    private static bool BeValidEmail(string email)
    {
        try
        {
            _ = new MailAddress(email);
            return true;
        }
        catch
        {
            return false;
        }
    }
}

public sealed class IssueActivationTicketRequestValidator
    : AbstractValidator<IssueActivationTicketRequest>
{
    public IssueActivationTicketRequestValidator() =>
        RuleFor(x => x.Id).NotEmpty().MaximumLength(450)
            .OverridePropertyName("id");
}

public sealed class UploadAttachmentRequestValidator : AbstractValidator<UploadAttachmentRequest>
{
    public UploadAttachmentRequestValidator()
    {
        RuleFor(x => x.Scope).NotEmpty().MaximumLength(64)
            .OverridePropertyName("scope");
        RuleFor(x => x.ScopeKey).NotEmpty().MaximumLength(512)
            .OverridePropertyName("scopeKey");
        RuleFor(x => x.FileName).NotEmpty().MaximumLength(512)
            .OverridePropertyName("fileName");
        RuleFor(x => x.ContentType).NotEmpty().MaximumLength(128)
            .OverridePropertyName("contentType");
        RuleFor(x => x.ContentBase64).NotEmpty()
            .OverridePropertyName("contentBase64");
    }
}

public sealed class CreateWorkOrderRequestValidator : AbstractValidator<CreateWorkOrderRequest>
{
    public CreateWorkOrderRequestValidator() =>
        RuleFor(x => x).Custom((request, context) =>
        {
            foreach (var (field, message) in WorkOrderValidator.ValidateHeader(request))
                context.AddFailure(field, message);
        });
}

public sealed class UpdateWorkOrderHeaderRequestValidator
    : AbstractValidator<UpdateWorkOrderHeaderRequest>
{
    public UpdateWorkOrderHeaderRequestValidator() =>
        RuleFor(x => x).Custom((request, context) =>
        {
            foreach (var (field, message) in WorkOrderValidator.ValidateUpdateHeader(request))
                context.AddFailure(field, message);
        });
}
