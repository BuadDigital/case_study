using FluentValidation;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Validation;

// Financial-owned boundary validators (A8): party-fee pricing endpoints, which only the
// financial host binds. Registered there via AddValidatorsFromAssemblyContaining.

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
