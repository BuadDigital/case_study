using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IFieldInspectionWorkspaceService
{
    Task<IReadOnlyList<FieldInspectionWorkspaceListItemDto>> ListAsync(
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    Task<FieldInspectionWorkspaceSummaryDto> GetSummaryAsync(
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
