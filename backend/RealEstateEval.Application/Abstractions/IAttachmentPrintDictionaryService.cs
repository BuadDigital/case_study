using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IAttachmentPrintDictionaryService
{
    Task<AttachmentPrintDictionaryDto> GetAsync(CancellationToken cancellationToken = default);

    Task<AttachmentPrintDictionaryDto> SaveAsync(
        SaveAttachmentPrintDictionaryRequest request,
        CancellationToken cancellationToken = default);
}
