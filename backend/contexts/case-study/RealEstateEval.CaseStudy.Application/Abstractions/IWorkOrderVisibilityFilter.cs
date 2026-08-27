using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Resolves which PO numbers a party actor may read on work-order lists.
/// Null means unrestricted (case staff); empty means nothing visible.
/// </summary>
public interface IWorkOrderVisibilityFilter
{
    Task<HashSet<string>?> ResolveVisiblePoNumbersAsync(
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    Task<bool> CanReadPoAsync(
        string poNumber,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
