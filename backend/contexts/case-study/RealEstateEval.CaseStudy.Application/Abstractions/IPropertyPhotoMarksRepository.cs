using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Persistence boundary for the specialist's photo marks; only Infrastructure opens EF.</summary>
public interface IPropertyPhotoMarksRepository
{
    /// <summary>The tracked property on <paramref name="poNumber"/>, or null when it does not exist.</summary>
    Task<WorkOrderProperty?> GetPropertyAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken);

    /// <summary>The latest case-study report of the property's study is issued.</summary>
    Task<bool> IsStudyReportIssuedAsync(Guid propertyId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
