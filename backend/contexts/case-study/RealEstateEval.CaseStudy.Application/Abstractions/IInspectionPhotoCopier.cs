namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Copies one inspection task's photo files to another task (grouped property: the sibling
/// deed's photos become this deed's, editable). Returns source attachment id → copied id.
/// The files live in the attachments service; the Infrastructure adapter calls it.
/// </summary>
public interface IInspectionPhotoCopier
{
    Task<IReadOnlyDictionary<Guid, Guid>> CopyInspectionPhotosAsync(
        Guid fromTaskId,
        Guid toTaskId,
        CancellationToken cancellationToken = default);
}
