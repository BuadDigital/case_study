using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IFailureService
{
    Task<IReadOnlyList<FailureRecordDto>> ListAsync(CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> GetActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default);

    Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateFailureRequest request,
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

    Task<FailureRecordDto?> UpgradeToInternalAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> SubmitForReviewAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> SuspendAsync(
        Guid id,
        string note,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> ResolveAsync(
        Guid id,
        ResolveFailureRequest request,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> ApproveAsync(
        Guid id,
        string finalNote,
        CancellationToken cancellationToken = default);

    Task<FailureRecordDto?> ReturnAsync(
        Guid id,
        string finalNote,
        CancellationToken cancellationToken = default);

    Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default);
}
