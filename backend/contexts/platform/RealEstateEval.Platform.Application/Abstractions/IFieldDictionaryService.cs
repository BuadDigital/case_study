using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Application.Abstractions;

public interface IFieldDictionaryService
{
    Task<FieldDictionaryStateDto> GetAsync(CancellationToken cancellationToken = default);
    Task<FieldDictionaryStateDto> SaveAsync(
        SaveFieldDictionaryStateRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}
