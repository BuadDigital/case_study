using System.Net.Mail;
using System.Text.RegularExpressions;
using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Validation;

internal static class FieldFormats
{
    internal static bool IsEmail(string value)
    {
        try
        {
            _ = new MailAddress(value);
            return true;
        }
        catch
        {
            return false;
        }
    }

    internal static bool IsHttpUrl(string value) =>
        Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    internal static bool IsSaudiIban(string value) =>
        Regex.IsMatch(value.Replace(" ", ""), @"^SA\d{22}$", RegexOptions.IgnoreCase);
}

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
        RuleFor(x => x.Email).NotEmpty().MaximumLength(256).Must(FieldFormats.IsEmail)
            .WithMessage("صيغة البريد الإلكتروني غير صالحة.")
            .OverridePropertyName("email");
        RuleFor(x => x.Mobile).NotEmpty().MaximumLength(20)
            .Matches(@"^(\+9665|05)\d{8}$")
            .WithMessage("صيغة رقم الجوال غير صالحة.")
            .OverridePropertyName("mobile");
        RuleFor(x => x.City).NotEmpty().MaximumLength(128)
            .OverridePropertyName("city");
        RuleFor(x => x.RoleId).NotEmpty().MaximumLength(128)
            .OverridePropertyName("roleId");
        RuleFor(x => x.Department).MaximumLength(128)
            .OverridePropertyName("department");
        RuleFor(x => x.NationalId).NotEmpty().Matches(@"^[12]\d{9}$")
            .OverridePropertyName("nationalId");
        RuleFor(x => x.InspectorType)
            .MaximumLength(32)
            .Must(value => value is not null
                           && value.Trim().ToLowerInvariant() is "employee" or "contractor")
            .When(x => x.RoleId == "field-inspector")
            .OverridePropertyName("inspectorType");
        RuleFor(x => x.FeeValueSar).GreaterThanOrEqualTo(0)
            .When(x => x.FeeValueSar.HasValue)
            .OverridePropertyName("feeValueSar");
        RuleFor(x => x.FeeValueSar).NotNull()
            .When(x => x.HasCompensation == true)
            .OverridePropertyName("feeValueSar");
        RuleFor(x => x.Iban)
            .MaximumLength(34)
            .Must(value => string.IsNullOrWhiteSpace(value) || FieldFormats.IsSaudiIban(value))
            .OverridePropertyName("iban");
        RuleFor(x => x.TaxNumber).MaximumLength(32)
            .OverridePropertyName("taxNumber");
        RuleFor(x => x.CommercialRegistration).MaximumLength(64)
            .OverridePropertyName("commercialRegistration");
        RuleFor(x => x.AvatarUrl)
            .MaximumLength(2048)
            .Must(value => string.IsNullOrWhiteSpace(value) || FieldFormats.IsHttpUrl(value))
            .WithMessage("رابط الصورة الشخصية غير صالح.")
            .OverridePropertyName("avatarUrl");
    }
}

/// <summary>
/// Shape-only checks for a partial update: every rule is skipped when its member is absent.
/// Required-ness, uniqueness and role/field coherence are enforced by the service, which is
/// the only layer that can see the stored row.
/// </summary>
public sealed class UpdateStaffUserRequestValidator : AbstractValidator<UpdateStaffUserRequest>
{
    public UpdateStaffUserRequestValidator()
    {
        RuleFor(x => x.DisplayName!).NotEmpty().MaximumLength(256)
            .When(x => x.DisplayName is not null)
            .OverridePropertyName("displayName");
        RuleFor(x => x.Email!).NotEmpty().MaximumLength(256).Must(FieldFormats.IsEmail)
            .WithMessage("صيغة البريد الإلكتروني غير صالحة.")
            .When(x => x.Email is not null)
            .OverridePropertyName("email");
        RuleFor(x => x.Mobile!).NotEmpty().MaximumLength(20)
            .Matches(@"^(\+9665|05)\d{8}$")
            .WithMessage("صيغة رقم الجوال غير صالحة.")
            .When(x => x.Mobile is not null)
            .OverridePropertyName("mobile");
        RuleFor(x => x.City!).NotEmpty().MaximumLength(128)
            .When(x => x.City is not null)
            .OverridePropertyName("city");
        RuleFor(x => x.RoleId!).NotEmpty().MaximumLength(128)
            .When(x => x.RoleId is not null)
            .OverridePropertyName("roleId");
        RuleFor(x => x.Department!).MaximumLength(128)
            .When(x => x.Department is not null)
            .OverridePropertyName("department");
        RuleFor(x => x.NationalId!).Matches(@"^[12]\d{9}$")
            .When(x => x.NationalId is not null)
            .OverridePropertyName("nationalId");
        RuleFor(x => x.InspectorType!)
            .Must(value => value.Length == 0
                           || value.Trim().ToLowerInvariant() is "employee" or "contractor")
            .When(x => x.InspectorType is not null)
            .OverridePropertyName("inspectorType");
        RuleFor(x => x.FeeValueSar!).GreaterThanOrEqualTo(0)
            .When(x => x.FeeValueSar.HasValue)
            .OverridePropertyName("feeValueSar");
        RuleFor(x => x.Iban!)
            .MaximumLength(34)
            .Must(value => value.Length == 0 || FieldFormats.IsSaudiIban(value))
            .When(x => x.Iban is not null)
            .OverridePropertyName("iban");
        RuleFor(x => x.TaxNumber!).MaximumLength(32)
            .When(x => x.TaxNumber is not null)
            .OverridePropertyName("taxNumber");
        RuleFor(x => x.CommercialRegistration!).MaximumLength(64)
            .When(x => x.CommercialRegistration is not null)
            .OverridePropertyName("commercialRegistration");
        RuleFor(x => x.AvatarUrl!)
            .MaximumLength(2048)
            .Must(value => value.Length == 0 || FieldFormats.IsHttpUrl(value))
            .WithMessage("رابط الصورة الشخصية غير صالح.")
            .When(x => x.AvatarUrl is not null)
            .OverridePropertyName("avatarUrl");
        RuleFor(x => x.Status!.Value)
            .Must(value => value is UserStatus.Active or UserStatus.Disabled)
            .WithMessage("الحالة المطلوبة غير مدعومة.")
            .When(x => x.Status.HasValue)
            .OverridePropertyName("status");
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
