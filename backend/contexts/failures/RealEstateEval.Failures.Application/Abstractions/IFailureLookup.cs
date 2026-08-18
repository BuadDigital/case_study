using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Read-only failure gates and lists. Failures host uses EF; Case Study and Operations call HTTP.
/// </summary>
public interface IFailureLookup
{
    Task<bool> HasActiveAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default);

    Task<bool> HasBlockingAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ListApprovedPropertyKeysAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FailureRecordDto>> ListForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FailureRecordDto>> ListSuspendedAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> ListActiveIdsByProblemAsync(
        string poNumber,
        string propertyId,
        string problemTypeId,
        string raisedByRole,
        CancellationToken cancellationToken = default);
}
