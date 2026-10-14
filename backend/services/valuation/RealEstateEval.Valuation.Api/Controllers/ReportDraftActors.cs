using System.Security.Claims;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Shared.Web;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>Builds the report-draft actor from the caller's claims and permissions.</summary>
internal static class ReportDraftActors
{
    public static async Task<ReportDraftActor> ResolveAsync(
        IPermissionService permissions,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(user);
        var permissionsDto = await permissions.GetForUserIdAsync(userId, cancellationToken);
        return new ReportDraftActor
        {
            UserId = userId,
            DisplayName = permissionsDto?.DisplayName,
            PrototypeRole = permissionsDto?.PrototypeRole,
            DistributionAssigneeId = permissionsDto?.DistributionAssigneeId,
        };
    }
}
