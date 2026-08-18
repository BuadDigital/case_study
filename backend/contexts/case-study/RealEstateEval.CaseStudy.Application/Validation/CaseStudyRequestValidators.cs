using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Validation;

// Case-study-owned boundary validators (A8): work orders, clients, and inspection limits.
// Registered on the Case Study host via AddValidatorsFromAssemblyContaining.

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
