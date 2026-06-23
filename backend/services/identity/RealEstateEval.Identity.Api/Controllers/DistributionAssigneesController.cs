using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Identity.Api.Controllers;

[ApiController]
[Route("api/users/distribution-assignees")]
[Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
public class DistributionAssigneesController : ControllerBase
{
    private readonly IUserRegistrationService _users;

    public DistributionAssigneesController(IUserRegistrationService users)
    {
        _users = users;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserListItemDto>>> List(
        CancellationToken cancellationToken)
    {
        var list = await _users.ListDistributionAssigneesAsync(cancellationToken);
        return Ok(list);
    }
}
