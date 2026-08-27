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
    }
}
