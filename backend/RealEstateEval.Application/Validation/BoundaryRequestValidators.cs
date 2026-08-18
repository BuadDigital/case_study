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

public sealed class CreateOperationsTaskRequestValidator : AbstractValidator<CreateOperationsTaskRequest>
{
    public CreateOperationsTaskRequestValidator()
    {
        RuleFor(x => x.Type)
            .NotEmpty()
            .Must(v => OperationsTaskTypeValues.TryParse(v, out _))
            .WithMessage("نوع المهمة غير مدعوم")
            .OverridePropertyName("type");
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500)
            .OverridePropertyName("title");
        RuleFor(x => x.Description!).MaximumLength(4000)
            .When(x => x.Description is not null)
            .OverridePropertyName("description");
        RuleFor(x => x.Scope)
            .NotEmpty()
            .Must(v => OperationsTaskScopeValues.TryParse(v, out _))
            .WithMessage("نطاق الربط غير مدعوم")
            .OverridePropertyName("scope");
        RuleFor(x => x.AssigneeId).NotEmpty().MaximumLength(450)
            .OverridePropertyName("assigneeId");
        RuleFor(x => x.Priority)
            .Must(v => string.IsNullOrWhiteSpace(v)
                       || OperationsTaskPriorityValues.TryParse(v, out _))
            .WithMessage("الأولوية غير مدعومة")
            .OverridePropertyName("priority");
        RuleFor(x => x.VisitFeeAmountSar!).GreaterThanOrEqualTo(0)
            .When(x => x.VisitFeeAmountSar.HasValue)
            .OverridePropertyName("visitFeeAmountSar");
    }
}

public sealed class PatchOperationsTaskRequestValidator : AbstractValidator<PatchOperationsTaskRequest>
{
    public PatchOperationsTaskRequestValidator()
    {
        RuleFor(x => x.Status!)
            .Must(v => OperationsTaskStatusValues.TryParse(v, out _))
            .When(x => !string.IsNullOrWhiteSpace(x.Status))
            .WithMessage("الحالة غير مدعومة")
            .OverridePropertyName("status");
        RuleFor(x => x.Priority!)
            .Must(v => OperationsTaskPriorityValues.TryParse(v, out _))
            .When(x => !string.IsNullOrWhiteSpace(x.Priority))
            .WithMessage("الأولوية غير مدعومة")
            .OverridePropertyName("priority");
        RuleFor(x => x.Title!).MaximumLength(500)
            .When(x => x.Title is not null)
            .OverridePropertyName("title");
        RuleFor(x => x.Description!).MaximumLength(4000)
            .When(x => x.Description is not null)
            .OverridePropertyName("description");
        RuleFor(x => x.PauseReason!).MaximumLength(2000)
            .When(x => x.PauseReason is not null)
            .OverridePropertyName("pauseReason");
        RuleFor(x => x.CancelReason!).MaximumLength(2000)
            .When(x => x.CancelReason is not null)
            .OverridePropertyName("cancelReason");
    }
}

public sealed class CreateKeyEnvelopeRequestValidator : AbstractValidator<CreateKeyEnvelopeRequest>
{
    public CreateKeyEnvelopeRequestValidator()
    {
        RuleFor(x => x.RequestNumber).NotEmpty().MaximumLength(128)
            .OverridePropertyName("requestNumber");
        RuleFor(x => x.Court).NotEmpty().MaximumLength(256)
            .OverridePropertyName("court");
        RuleFor(x => x.Circuit).NotEmpty().MaximumLength(150)
            .OverridePropertyName("circuit");
        RuleFor(x => x.KeysCountLabeled).InclusiveBetween(0, 9999)
            .OverridePropertyName("keysCountLabeled");
        RuleFor(x => x.KeysCountActual).InclusiveBetween(0, 9999)
            .OverridePropertyName("keysCountActual");
        RuleFor(x => x.ReceiveScenario)
            .Must(v => v is KeyReceiveScenarios.Court
                or KeyReceiveScenarios.Missing
                or KeyReceiveScenarios.ThirdParty)
            .WithMessage("سيناريو الاستلام غير مدعوم")
            .OverridePropertyName("receiveScenario");
        RuleFor(x => x.ContactPhones!).MaximumLength(1000)
            .When(x => x.ContactPhones is not null)
            .OverridePropertyName("contactPhones");
        RuleFor(x => x.Notes!).MaximumLength(4000)
            .When(x => x.Notes is not null)
            .OverridePropertyName("notes");
    }
}

public sealed class CreateCourtRequestValidator : AbstractValidator<CreateCourtRequest>
{
    public CreateCourtRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256)
            .OverridePropertyName("name");
        RuleFor(x => x.Region).NotEmpty().MaximumLength(128)
            .OverridePropertyName("region");
        RuleFor(x => x.City).NotEmpty().MaximumLength(128)
            .OverridePropertyName("city");
    }
}

public sealed class UpdateCourtRequestValidator : AbstractValidator<UpdateCourtRequest>
{
    public UpdateCourtRequestValidator()
    {
        RuleFor(x => x.Name!).NotEmpty().MaximumLength(256)
            .When(x => x.Name is not null)
            .OverridePropertyName("name");
        RuleFor(x => x.Region!).NotEmpty().MaximumLength(128)
            .When(x => x.Region is not null)
            .OverridePropertyName("region");
        RuleFor(x => x.City!).NotEmpty().MaximumLength(128)
            .When(x => x.City is not null)
            .OverridePropertyName("city");
    }
}

public sealed class CreateCourtCircuitRequestValidator : AbstractValidator<CreateCourtCircuitRequest>
{
    public CreateCourtCircuitRequestValidator()
    {
        RuleFor(x => x.CircuitNo).NotEmpty().MaximumLength(64)
            .OverridePropertyName("circuitNo");
        RuleFor(x => x.CircuitName!).MaximumLength(256)
            .When(x => x.CircuitName is not null)
            .OverridePropertyName("circuitName");
    }
}

public sealed class UpdateCourtCircuitRequestValidator : AbstractValidator<UpdateCourtCircuitRequest>
{
    public UpdateCourtCircuitRequestValidator()
    {
        RuleFor(x => x.CircuitNo!).NotEmpty().MaximumLength(64)
            .When(x => x.CircuitNo is not null)
            .OverridePropertyName("circuitNo");
        RuleFor(x => x.CircuitName!).MaximumLength(256)
            .When(x => x.CircuitName is not null)
            .OverridePropertyName("circuitName");
    }
}

public sealed class SaveCourtsCatalogRequestValidator : AbstractValidator<SaveCourtsCatalogRequest>
{
    public SaveCourtsCatalogRequestValidator() =>
        RuleForEach(x => x.Entries).SetValidator(new CourtCatalogEntryDtoValidator());
}

public sealed class CourtCatalogEntryDtoValidator : AbstractValidator<CourtCatalogEntryDto>
{
    public CourtCatalogEntryDtoValidator()
    {
        RuleFor(x => x.City).NotEmpty().MaximumLength(128)
            .OverridePropertyName("city");
        RuleFor(x => x.Court).NotEmpty().MaximumLength(256)
            .OverridePropertyName("court");
        RuleForEach(x => x.Circuits)
            .NotEmpty()
            .MaximumLength(64)
            .OverridePropertyName("circuits");
    }
}

public sealed class ReassignOperationsTaskRequestValidator
    : AbstractValidator<ReassignOperationsTaskRequest>
{
    public ReassignOperationsTaskRequestValidator()
    {
        RuleFor(x => x.AssigneeId).NotEmpty().MaximumLength(450)
            .OverridePropertyName("assigneeId");
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(2000)
            .OverridePropertyName("reason");
    }
}

public sealed class AddOperationsTaskCommentRequestValidator
    : AbstractValidator<AddOperationsTaskCommentRequest>
{
    public AddOperationsTaskCommentRequestValidator()
    {
        RuleFor(x => x.Text).MaximumLength(4000)
            .OverridePropertyName("text");
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.Text) || (x.Files?.Count ?? 0) > 0)
            .WithMessage("التعليق يحتاج نصاً أو مرفقاً.")
            .OverridePropertyName("text");
        RuleFor(x => x.Kind!).MaximumLength(64)
            .When(x => x.Kind is not null)
            .OverridePropertyName("kind");
    }
}

public sealed class AddKeyEnvelopeAssignmentRequestValidator
    : AbstractValidator<AddKeyEnvelopeAssignmentRequest>
{
    public AddKeyEnvelopeAssignmentRequestValidator()
    {
        RuleFor(x => x.DeedNumber).NotEmpty().MaximumLength(128)
            .OverridePropertyName("deedNumber");
        RuleFor(x => x.Notes!).MaximumLength(2000)
            .When(x => x.Notes is not null)
            .OverridePropertyName("notes");
    }
}

public sealed class ConfirmKeyAssignmentRequestValidator
    : AbstractValidator<ConfirmKeyAssignmentRequest>
{
    public ConfirmKeyAssignmentRequestValidator()
    {
        RuleFor(x => x.Status)
            .NotEmpty()
            .Must(KeyAssignmentStatuses.IsConfirmResult)
            .WithMessage("حالة المطابقة غير مدعومة")
            .OverridePropertyName("status");
        RuleFor(x => x.Notes!).MaximumLength(2000)
            .When(x => x.Notes is not null)
            .OverridePropertyName("notes");
    }
}

public sealed class CreateKeyEnvelopeHandoffRequestValidator
    : AbstractValidator<CreateKeyEnvelopeHandoffRequest>
{
    public CreateKeyEnvelopeHandoffRequestValidator()
    {
        RuleFor(x => x.Kind)
            .Must(v => v is KeyHandoffKinds.Internal
                or KeyHandoffKinds.External
                or KeyHandoffKinds.ReceiveBack
                or KeyHandoffKinds.ReturnCourt)
            .WithMessage("نوع المناولة غير مدعوم")
            .OverridePropertyName("kind");
        RuleFor(x => x.FromParty).NotEmpty().MaximumLength(256)
            .OverridePropertyName("fromParty");
        RuleFor(x => x.ToParty).NotEmpty().MaximumLength(256)
            .OverridePropertyName("toParty");
        RuleFor(x => x.Notes!).MaximumLength(2000)
            .When(x => x.Notes is not null)
            .OverridePropertyName("notes");
    }
}

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

public sealed class SaveOrganizationSettingsRequestValidator
    : AbstractValidator<SaveOrganizationSettingsRequest>
{
    public SaveOrganizationSettingsRequestValidator()
    {
        RuleFor(x => x.Sla!.DefaultBusinessDays).InclusiveBetween(1, 90)
            .When(x => x.Sla is not null)
            .OverridePropertyName("sla.defaultBusinessDays");
        RuleFor(x => x.Sla!.PrivateSectorBusinessDays).InclusiveBetween(1, 90)
            .When(x => x.Sla is not null)
            .OverridePropertyName("sla.privateSectorBusinessDays");
        RuleFor(x => x.Valuation!.MaxAdoptedComparables).InclusiveBetween(1, 20)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.maxAdoptedComparables");
        RuleFor(x => x.Valuation!.ComparableTimeGapMonths).InclusiveBetween(1, 60)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.comparableTimeGapMonths");
        RuleFor(x => x.Communications!.OtpProvider!)
            .Must(v => v is "dev-log" or "sms" or "email")
            .When(x => x.Communications is not null && !string.IsNullOrWhiteSpace(x.Communications.OtpProvider))
            .OverridePropertyName("communications.otpProvider");
        RuleFor(x => x.Communications!.EmailFrom!)
            .Must(value => string.IsNullOrWhiteSpace(value) || FieldFormats.IsEmail(value))
            .When(x => x.Communications?.EmailFrom is not null)
            .WithMessage("صيغة البريد الإلكتروني غير صالحة.")
            .OverridePropertyName("communications.emailFrom");
        RuleFor(x => x.Communications!.SmtpPort).InclusiveBetween(1, 65535)
            .When(x => x.Communications is not null)
            .OverridePropertyName("communications.smtpPort");
    }
}

public sealed class TestCommunicationRequestValidator : AbstractValidator<TestCommunicationRequest>
{
    public TestCommunicationRequestValidator()
    {
        RuleFor(x => x.Channel)
            .Must(v => v is "sms" or "email")
            .WithMessage("قناة الاختبار غير مدعومة")
            .OverridePropertyName("channel");
        RuleFor(x => x.Destination).NotEmpty().MaximumLength(256)
            .OverridePropertyName("destination");
        RuleFor(x => x.Destination)
            .Must(FieldFormats.IsEmail)
            .When(x => x.Channel == "email")
            .WithMessage("صيغة البريد الإلكتروني غير صالحة.")
            .OverridePropertyName("destination");
    }
}
