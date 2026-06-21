using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IFieldDictionaryService
{
    Task<FieldDictionaryStateDto> GetAsync(CancellationToken cancellationToken = default);
    Task<FieldDictionaryStateDto> SaveAsync(
        SaveFieldDictionaryStateRequest request,
        CancellationToken cancellationToken = default);
}
