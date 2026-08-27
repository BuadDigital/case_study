using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Failures.Application.Contracts;

namespace RealEstateEval.Failures.Application.Validation;

public sealed class CreateFailureRequestValidator : AbstractValidator<CreateFailureRequest>
{
    public CreateFailureRequestValidator()
    {
        RuleFor(x => x.PoNumber).NotEmpty().MaximumLength(64)
            .OverridePropertyName("poNumber");
        RuleFor(x => x.PropertyId).NotEmpty().MaximumLength(64)
            .OverridePropertyName("propertyId");
        RuleFor(x => x.ProblemTypeId).NotEmpty().MaximumLength(128)
            .OverridePropertyName("problemTypeId");
        RuleFor(x => x.Severity).NotEmpty().MaximumLength(32)
            .OverridePropertyName("severity");
        RuleFor(x => x.Specialist).NotEmpty().MaximumLength(256)
            .OverridePropertyName("specialist");
        RuleFor(x => x.Title!).MaximumLength(500)
            .When(x => x.Title is not null)
            .OverridePropertyName("title");
        RuleFor(x => x.InternalNote!).MaximumLength(4000)
            .When(x => x.InternalNote is not null)
            .OverridePropertyName("internalNote");
    }
}

public sealed class BourseObstructionRequestValidator : AbstractValidator<BourseObstructionRequest>
{
    public BourseObstructionRequestValidator()
    {
        RuleFor(x => x.PoNumber).NotEmpty().MaximumLength(64)
            .OverridePropertyName("poNumber");
        RuleFor(x => x.PropertyId).NotEmpty().MaximumLength(64)
            .OverridePropertyName("propertyId");
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(4000)
            .OverridePropertyName("reason");
        RuleFor(x => x.Specialist).NotEmpty().MaximumLength(256)
            .OverridePropertyName("specialist");
    }
}

public sealed class ResolveFailureRequestValidator : AbstractValidator<ResolveFailureRequest>
{
    public ResolveFailureRequestValidator()
    {
        RuleFor(x => x.ResolutionReason).NotEmpty().MaximumLength(2000)
            .OverridePropertyName("resolutionReason");
        RuleFor(x => x.ContinueInstructions!).MaximumLength(4000)
            .When(x => x.ContinueInstructions is not null)
            .OverridePropertyName("continueInstructions");
    }
}

public sealed class FailureNoteRequestValidator : AbstractValidator<FailureNoteRequest>
{
    public FailureNoteRequestValidator() =>
        RuleFor(x => x.Note).NotEmpty().MaximumLength(4000)
            .OverridePropertyName("note");
}
