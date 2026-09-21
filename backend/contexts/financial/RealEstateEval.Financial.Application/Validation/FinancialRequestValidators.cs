using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application;

namespace RealEstateEval.Financial.Application.Validation;

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
