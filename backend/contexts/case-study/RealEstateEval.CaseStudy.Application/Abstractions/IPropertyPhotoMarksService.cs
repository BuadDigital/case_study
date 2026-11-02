using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IPropertyPhotoMarksService
{
    Task<(PropertyPhotoMarksDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        string poNumber,
        Guid propertyId,
        PropertyPhotoMarksDto request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken);
}
