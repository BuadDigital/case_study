using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface ICaseStudyFormService
{
    Task<CaseStudyFormDto?> GetAsync(Guid taskId, bool party, CancellationToken cancellationToken = default);
    Task<(CaseStudyFormDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid taskId,
        bool party,
        CaseStudyFormDto form,
        CancellationToken cancellationToken = default);
}
