using System.Net.Mail;
using System.Text.RegularExpressions;
using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Validation;

// Public: the Platform slice's validators (RealEstateEval.Platform.Application) share these
// format helpers.
public static class FieldFormats
{
    public static bool IsEmail(string value)
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

    public static bool IsHttpUrl(string value) =>
        Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    public static bool IsSaudiIban(string value) =>
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

// Operations-task and key-envelope validators moved to RealEstateEval.Operations.Application (A8).

// Court and courts-catalog validators moved to RealEstateEval.Platform.Application (A8).

public sealed class MarkKeyReceiptFeeCollectedRequestValidator
    : AbstractValidator<MarkKeyReceiptFeeCollectedRequest>
{
    public MarkKeyReceiptFeeCollectedRequestValidator() =>
        RuleFor(x => x.InvoiceReference!).MaximumLength(128)
            .When(x => x.InvoiceReference is not null)
            .OverridePropertyName("invoiceReference");
}

public sealed class UpsertClientRequestValidator : AbstractValidator<UpsertClientRequest>
{
    public UpsertClientRequestValidator()
    {
        RuleFor(x => x.NameAr).NotEmpty().MaximumLength(256)
            .OverridePropertyName("nameAr");
        RuleFor(x => x.NameEn!).MaximumLength(256)
            .When(x => x.NameEn is not null)
            .OverridePropertyName("nameEn");
        RuleFor(x => x.IdentityNumber!).MaximumLength(64)
            .When(x => x.IdentityNumber is not null)
            .OverridePropertyName("identityNumber");
        RuleFor(x => x.Phone!).MaximumLength(32)
            .When(x => x.Phone is not null)
            .OverridePropertyName("phone");
        RuleFor(x => x.Email!)
            .MaximumLength(256)
            .Must(value => string.IsNullOrWhiteSpace(value) || FieldFormats.IsEmail(value))
            .WithMessage("صيغة البريد الإلكتروني غير صالحة.")
            .When(x => x.Email is not null)
            .OverridePropertyName("email");
    }
}

public sealed class SaveInspectionLimitsRequestValidator
    : AbstractValidator<SaveInspectionLimitsRequest>
{
    public SaveInspectionLimitsRequestValidator()
    {
        RuleFor(x => x.InspectionScopeKey)
            .Must(InspectionScopeKeys.IsKnown)
            .WithMessage("نطاق المعاينة غير مدعوم")
            .OverridePropertyName("inspectionScopeKey");
        RuleFor(x => x.InspectionRestrictionReason!).MaximumLength(2000)
            .When(x => x.InspectionRestrictionReason is not null)
            .OverridePropertyName("inspectionRestrictionReason");
        RuleForEach(x => x.UninspectedUnits).ChildRules(unit =>
        {
            unit.RuleFor(u => u.Count).GreaterThanOrEqualTo(0)
                .OverridePropertyName("count");
            unit.RuleFor(u => u.Reason).NotEmpty().MaximumLength(500)
                .OverridePropertyName("reason");
        });
    }
}

public sealed class CreatePartyFeePricingTableRequestValidator
    : AbstractValidator<CreatePartyFeePricingTableRequest>
{
    public CreatePartyFeePricingTableRequestValidator()
    {
        RuleFor(x => x.Category)
            .Must(PartyFeePricingCategories.IsValid)
            .WithMessage(x => PartyFeePricingCategories.InvalidMessage(x.Category))
            .OverridePropertyName("category");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256)
            .OverridePropertyName("name");
        RuleFor(x => x.PricingKind!)
            .Must(PartyFeePricingKinds.IsValid)
            .When(x => !string.IsNullOrWhiteSpace(x.PricingKind))
            .WithMessage(x => PartyFeePricingKinds.InvalidMessage(x.PricingKind))
            .OverridePropertyName("pricingKind");
        RuleFor(x => x.ManagedBy!)
            .Must(PartyFeePricingManagers.IsValid)
            .When(x => !string.IsNullOrWhiteSpace(x.ManagedBy))
            .WithMessage(x => PartyFeePricingManagers.InvalidMessage(x.ManagedBy))
            .OverridePropertyName("managedBy");
        RuleFor(x => x.FlatAmountSar!).GreaterThanOrEqualTo(0)
            .When(x => x.FlatAmountSar.HasValue)
            .OverridePropertyName("flatAmountSar");
    }
}

public sealed class SetPartyFeePricingAssignmentsRequestValidator
    : AbstractValidator<SetPartyFeePricingAssignmentsRequest>
{
    public SetPartyFeePricingAssignmentsRequestValidator() =>
        RuleForEach(x => x.AssigneeIds)
            .NotEmpty()
            .MaximumLength(450)
            .OverridePropertyName("assigneeIds");
}

// Organization-settings and communication-test validators moved to
// RealEstateEval.Platform.Application (A8).

// B6 residual closed 2026-08-18 — nested billing bodies. Valuation save bodies already
// carry DataAnnotations enforced by [ApiController]; billing bodies had no caps at all.

public sealed class CreatePartyBillingStatementRequestValidator
    : AbstractValidator<CreatePartyBillingStatementRequest>
{
    public CreatePartyBillingStatementRequestValidator()
    {
        RuleFor(x => x.WorkflowTaskIds)
            .Must(ids => ids.Count <= 500)
            .WithMessage("لا يمكن تضمين أكثر من 500 مهمة في كشف واحد")
            .OverridePropertyName("workflowTaskIds");
        RuleForEach(x => x.WorkflowTaskIds).NotEmpty().MaximumLength(64)
            .OverridePropertyName("workflowTaskIds");
        RuleFor(x => x.Notes!).MaximumLength(4000)
            .When(x => x.Notes is not null)
            .OverridePropertyName("notes");
    }
}

public sealed class ClosePartyBillingStatementRequestValidator
    : AbstractValidator<ClosePartyBillingStatementRequest>
{
    public ClosePartyBillingStatementRequestValidator()
    {
        RuleFor(x => x.DisbursementVoucher).NotEmpty().MaximumLength(128)
            .OverridePropertyName("disbursementVoucher");
        RuleFor(x => x.TransferReference).NotEmpty().MaximumLength(128)
            .OverridePropertyName("transferReference");
        RuleFor(x => x.TransferReceiptAttachmentId).NotEmpty().MaximumLength(64)
            .OverridePropertyName("transferReceiptAttachmentId");
        RuleFor(x => x.TransferReceiptRef!).MaximumLength(256)
            .When(x => x.TransferReceiptRef is not null)
            .OverridePropertyName("transferReceiptRef");
        RuleFor(x => x.ExternalInvoiceNumber!).MaximumLength(128)
            .When(x => x.ExternalInvoiceNumber is not null)
            .OverridePropertyName("externalInvoiceNumber");
        RuleFor(x => x.Notes!).MaximumLength(4000)
            .When(x => x.Notes is not null)
            .OverridePropertyName("notes");
    }
}

public sealed class SubmitVendorInvoiceRequestValidator : AbstractValidator<SubmitVendorInvoiceRequest>
{
    public SubmitVendorInvoiceRequestValidator()
    {
        RuleFor(x => x.InvoiceNumber).NotEmpty().MaximumLength(128)
            .OverridePropertyName("invoiceNumber");
        RuleFor(x => x.AttachmentId).NotEmpty().MaximumLength(64)
            .OverridePropertyName("attachmentId");
    }
}

public sealed class RejectVendorInvoiceRequestValidator : AbstractValidator<RejectVendorInvoiceRequest>
{
    public RejectVendorInvoiceRequestValidator() =>
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(4000)
            .OverridePropertyName("reason");
}

public sealed class CancelPartyBillingStatementRequestValidator
    : AbstractValidator<CancelPartyBillingStatementRequest>
{
    public CancelPartyBillingStatementRequestValidator() =>
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(4000)
            .OverridePropertyName("reason");
}

public sealed class DeferPartyBillingLinesRequestValidator
    : AbstractValidator<DeferPartyBillingLinesRequest>
{
    public DeferPartyBillingLinesRequestValidator()
    {
        RuleFor(x => x.WorkflowTaskIds)
            .Must(ids => ids.Count <= 500)
            .WithMessage("لا يمكن تأجيل أكثر من 500 مهمة في طلب واحد")
            .OverridePropertyName("workflowTaskIds");
        RuleForEach(x => x.WorkflowTaskIds).NotEmpty().MaximumLength(64)
            .OverridePropertyName("workflowTaskIds");
    }
}

public sealed class SavePoEnfazBillingRequestValidator : AbstractValidator<SavePoEnfazBillingRequest>
{
    public SavePoEnfazBillingRequestValidator()
    {
        RuleFor(x => x.Lines)
            .Must(lines => lines.Count <= 500)
            .WithMessage("لا يمكن حفظ أكثر من 500 سطر إيراد في طلب واحد")
            .OverridePropertyName("lines");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.PropertyId).NotEmpty().MaximumLength(64)
                .OverridePropertyName("propertyId");
            line.RuleFor(l => l.KeyEntitlementEnvelopeId!).MaximumLength(64)
                .When(l => l.KeyEntitlementEnvelopeId is not null)
                .OverridePropertyName("keyEntitlementEnvelopeId");
        }).OverridePropertyName("lines");
    }
}

public sealed class CollectPoEnfazInvoiceRequestValidator : AbstractValidator<CollectPoEnfazInvoiceRequest>
{
    public CollectPoEnfazInvoiceRequestValidator() =>
        RuleFor(x => x.Note!).MaximumLength(4000)
            .When(x => x.Note is not null)
            .OverridePropertyName("note");
}
