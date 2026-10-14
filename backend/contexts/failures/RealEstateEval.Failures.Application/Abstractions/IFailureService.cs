using RealEstateEval.Application.Contracts;
using RealEstateEval.Failures.Application.Contracts;

namespace RealEstateEval.Failures.Application.Abstractions;

public interface IFailureService
{
    /// <summary>Filtered / sorted plain list. Paging members of the query are ignored here.</summary>
    Task<IReadOnlyList<FailureRecordDto>> ListAsync(
        FailureListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered / sorted page. Visibility is applied before the count.</summary>
    Task<PagedResultDto<FailureRecordDto>> ListPagedAsync(
        FailureListQuery query,
        PermissionsDto? actor,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FailureRecordDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> GetActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);

    Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateFailureRequest request,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> ReportBourseObstructionAsync(
        BourseObstructionRequest request,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Creates an internal system failure when none is active for the property
 /// (idempotent for the given problem type while active).
 /// </summary>
    Task<FailureRecordDto?> EnsureSystemInternalFailureAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string problemTypeId,
        string title,
        string note,
        string specialist,
        CancellationToken cancellationToken = default);

    Task ApplyEvictionHoldAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default);

    Task ResolveEvictionHoldsAsync(
        string poNumber,
        string propertyId,
        string actor,
        CancellationToken cancellationToken = default);

    Task EnsureKeyUnmatchedFailureAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> UpgradeToInternalAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> SubmitForReviewAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> SuspendAsync(
        Guid id,
        string note,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> ResolveAsync(
        Guid id,
        ResolveFailureRequest request,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> ApproveAsync(
        Guid id,
        string finalNote,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> ReturnAsync(
        Guid id,
        string finalNote,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Lifts the engineering-survey freeze on every active failure of the property (idempotent:
    /// already-lifted failures are left alone). The failures stay active. Case specialist only —
    /// <paramref name="actorPrototypeRole"/> is judged by <c>PoRoleMatrixRules.CanLiftSurveyFreeze</c>
    /// (error key <c>_</c> when denied; the API answers 403 before it gets here). Field errors:
    /// <c>poNumber</c>, <c>propertyId</c>, <c>reason</c> (at least ten characters).
    /// </summary>
    Task<(LiftSurveyFreezeResultDto? Result, Dictionary<string, string>? Errors)> LiftSurveyFreezeAsync(
        LiftSurveyFreezeRequest request,
        string? actorUserId,
        string? actorPrototypeRole,
        CancellationToken cancellationToken = default);

    Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default);
}
