using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IFieldInspectionWorkspaceService
{
    Task<IReadOnlyList<FieldInspectionWorkspaceListItemDto>> ListAsync(
        PermissionsDto actor,
        CancellationToken cancellationToken = default);

    Task<FieldInspectionWorkspaceSummaryDto> GetSummaryAsync(
        CancellationToken cancellationToken = default);
}
