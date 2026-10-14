using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Application.Abstractions;

public interface IFieldDictionaryService
{
    Task<FieldDictionaryStateDto> GetAsync(CancellationToken cancellationToken = default);
}
