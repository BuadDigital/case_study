using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Application.Validation;

namespace RealEstateEval.Platform.Application.Validation;

// Platform-owned boundary validators (A8): courts catalogs, organization settings, and
// communication tests. Registered on the Platform host via AddValidatorsFromAssemblyContaining.

public sealed class CreateCourtRequestValidator : AbstractValidator<CreateCourtRequest>
{
    public CreateCourtRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150)
            .OverridePropertyName("name");
        RuleFor(x => x.Region).NotEmpty().MaximumLength(80)
            .OverridePropertyName("region");
        RuleFor(x => x.City).NotEmpty().MaximumLength(80)
            .OverridePropertyName("city");
    }
}

public sealed class UpdateCourtRequestValidator : AbstractValidator<UpdateCourtRequest>
{
    public UpdateCourtRequestValidator()
    {
        RuleFor(x => x.Name!).NotEmpty().MaximumLength(150)
            .When(x => x.Name is not null)
            .OverridePropertyName("name");
        RuleFor(x => x.Region!).NotEmpty().MaximumLength(80)
            .When(x => x.Region is not null)
            .OverridePropertyName("region");
        RuleFor(x => x.City!).NotEmpty().MaximumLength(80)
            .When(x => x.City is not null)
            .OverridePropertyName("city");
    }
}

public sealed class CreateCourtCircuitRequestValidator : AbstractValidator<CreateCourtCircuitRequest>
{
    public CreateCourtCircuitRequestValidator()
    {
        RuleFor(x => x.CircuitNo).NotEmpty().MaximumLength(50)
            .OverridePropertyName("circuitNo");
        RuleFor(x => x.CircuitName!).MaximumLength(150)
            .When(x => x.CircuitName is not null)
            .OverridePropertyName("circuitName");
    }
}

public sealed class UpdateCourtCircuitRequestValidator : AbstractValidator<UpdateCourtCircuitRequest>
{
    public UpdateCourtCircuitRequestValidator()
    {
        RuleFor(x => x.CircuitNo!).NotEmpty().MaximumLength(50)
            .When(x => x.CircuitNo is not null)
            .OverridePropertyName("circuitNo");
        RuleFor(x => x.CircuitName!).MaximumLength(150)
            .When(x => x.CircuitName is not null)
            .OverridePropertyName("circuitName");
    }
}

public sealed class SaveOrganizationSettingsRequestValidator
    : AbstractValidator<SaveOrganizationSettingsRequest>
{
    public SaveOrganizationSettingsRequestValidator()
    {
        RuleFor(x => x.Sla!.DefaultBusinessDays).InclusiveBetween(1, 60)
            .When(x => x.Sla is not null)
            .OverridePropertyName("sla.defaultBusinessDays");
        RuleFor(x => x.Sla!.PrivateSectorBusinessDays).InclusiveBetween(1, 60)
            .When(x => x.Sla is not null)
            .OverridePropertyName("sla.privateSectorBusinessDays");
        RuleFor(x => x.Valuation!.MaxAdoptedComparables).InclusiveBetween(1, 3)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.maxAdoptedComparables");
        RuleFor(x => x.Valuation!.AreaFactorPct).InclusiveBetween(0.1m, 50m)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.areaFactorPct");
        RuleFor(x => x.Valuation!.AnnualMarketRatePct).InclusiveBetween(0m, 50m)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.annualMarketRatePct");
        RuleFor(x => x.Valuation!.MarketValueRoundDecimals).InclusiveBetween(0, 6)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.marketValueRoundDecimals");
    }
}

