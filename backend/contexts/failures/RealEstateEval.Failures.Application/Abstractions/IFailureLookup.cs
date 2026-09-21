using RealEstateEval.Application.Contracts;
using RealEstateEval.Failures.Application.Contracts;

namespace RealEstateEval.Failures.Application.Abstractions;

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

    /// <summary>
    /// "PO|propertyId" of every property with a failure that is neither resolved nor suspended
    /// (the same set <see cref="HasBlockingAsync"/> answers per property), so a list can mark
    /// its rows obstructed with one call.
    /// </summary>
    Task<IReadOnlyList<string>> ListBlockingPropertyKeysAsync(
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
