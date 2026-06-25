namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Creates valuation requests when case study sends a property to the valuation department.
/// </summary>
public interface ICaseStudyValuationDispatchService
{
    Task TryCreateFromCaseStudySubmissionAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken = default);
}
