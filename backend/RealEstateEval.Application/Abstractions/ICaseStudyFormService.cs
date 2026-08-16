using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface ICaseStudyFormService
{
 /// <summary>
 /// Reads a form. When <paramref name="actor"/> is supplied, party forms require
 /// <see cref="Rules.PoRoleMatrixRules.CanReadPartyTask"/> and the internal case-study form
 /// requires case-staff role; otherwise null is returned so callers cannot probe existence.
 /// </summary>
    Task<CaseStudyFormDto?> GetAsync(
        Guid taskId,
        bool party,
        CaseStudyFormActor? actor = null,
        CancellationToken cancellationToken = default);
    Task<(CaseStudyFormDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid taskId,
        bool party,
        CaseStudyFormDto form,
        CaseStudyFormActor? actor = null,
        CancellationToken cancellationToken = default);
}
