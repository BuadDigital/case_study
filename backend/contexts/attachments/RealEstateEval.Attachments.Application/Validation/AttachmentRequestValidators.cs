using FluentValidation;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Attachments.Application.Contracts;

namespace RealEstateEval.Attachments.Application.Validation;

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
        RuleFor(x => x.DocumentTypeKey).MaximumLength(64)
            .OverridePropertyName("documentTypeKey");
        RuleFor(x => x.CustomDocumentLabel).MaximumLength(128)
            .OverridePropertyName("customDocumentLabel");
        RuleFor(x => x.CustomDocumentReason).MaximumLength(512)
            .OverridePropertyName("customDocumentReason");
    }
}

public sealed class SetAttachmentDocumentTypeRequestValidator
    : AbstractValidator<SetAttachmentDocumentTypeRequest>
{
    public SetAttachmentDocumentTypeRequestValidator()
    {
        RuleFor(x => x.DocumentTypeKey).NotEmpty().WithMessage("اختر نوع المستند")
            .MaximumLength(64)
            .OverridePropertyName("documentTypeKey");
        RuleFor(x => x.CustomDocumentLabel).MaximumLength(128)
            .OverridePropertyName("customDocumentLabel");
        RuleFor(x => x.CustomDocumentReason).MaximumLength(512)
            .OverridePropertyName("customDocumentReason");
    }
}

public sealed class ReviewAttachmentDocumentRequestValidator
    : AbstractValidator<ReviewAttachmentDocumentRequest>
{
    public ReviewAttachmentDocumentRequestValidator()
    {
        RuleFor(x => x.Decision).NotEmpty().WithMessage("اختر قرار المراجعة")
            .MaximumLength(16)
            .OverridePropertyName("decision");
        RuleFor(x => x.Note).MaximumLength(512)
            .OverridePropertyName("note");
    }
}
