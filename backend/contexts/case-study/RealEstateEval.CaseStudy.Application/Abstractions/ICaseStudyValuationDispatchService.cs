namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Creates the native valuation request as content of the property-appraisal child
/// (spawned at distribution — not when the parent case-study form is submitted).
/// </summary>
public interface ICaseStudyValuationDispatchService
{
    Task TryCreateWhenAppraisalSpawnedAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken = default);
}
