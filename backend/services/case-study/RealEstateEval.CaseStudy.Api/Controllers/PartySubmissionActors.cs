using System.Security.Claims;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.CaseStudy.Api.Controllers;

internal static class PartySubmissionActors
{
    /// <summary>Identity comes from the token, never the body — it stamps who wrote each line.</summary>
    public static async Task<PartySubmissionActor> ResolveAsync(
        ClaimsPrincipal user,
        IPermissionService permissions,
        CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(user);
        var known = !string.IsNullOrWhiteSpace(userId) && userId != "unknown";
        var perms = known ? await permissions.GetForUserIdAsync(userId, cancellationToken) : null;

        return new PartySubmissionActor
        {
            UserId = known ? userId : "",
            DisplayName = ActorClaims.DisplayName(user),
            PrototypeRole = perms?.PrototypeRole,
            DistributionAssigneeId = perms?.DistributionAssigneeId,
        };
    }
}
