using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Validation;

// Operations-owned boundary validators (A8): operations tasks and key envelopes.
// Registered on the Operations host via AddValidatorsFromAssemblyContaining.

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
