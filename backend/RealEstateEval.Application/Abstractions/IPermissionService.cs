using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPermissionService
{
    Task<PermissionsDto?> GetForUserIdAsync(string userId, CancellationToken cancellationToken = default);
}
