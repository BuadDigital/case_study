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
        RuleFor(x => x.Valuation!.AreaFactorPct).InclusiveBetween(0.1m, 50m)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.areaFactorPct");
        RuleFor(x => x.Valuation!.AnnualMarketRatePct).InclusiveBetween(0m, 50m)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.annualMarketRatePct");
        RuleFor(x => x.Valuation!.MarketValueRoundDecimals).InclusiveBetween(0, 6)
            .When(x => x.Valuation is not null)
            .OverridePropertyName("valuation.marketValueRoundDecimals");
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
