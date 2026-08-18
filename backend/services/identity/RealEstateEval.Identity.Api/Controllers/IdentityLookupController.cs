using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Identity.Api.Controllers;

[ApiController]
[Route("api/identity")]
[Authorize]
public sealed class IdentityLookupController(IIdentityDirectory directory) : ControllerBase
{
    [HttpGet("labels")]
    public async Task<ActionResult<IReadOnlyList<UserLabelDto>>> Labels(
        [FromQuery] string ids,
        CancellationToken cancellationToken)
    {
        var parsed = ParseIds(ids);
        var map = await directory.ResolveDisplayNamesByUserIdsAsync(parsed, cancellationToken);
        return Ok(map.Select(kv => new UserLabelDto { Id = kv.Key, DisplayName = kv.Value }).ToList());
    }

    [HttpGet("assignee-labels")]
    public async Task<ActionResult<IReadOnlyList<UserLabelDto>>> AssigneeLabels(
        [FromQuery] string ids,
        CancellationToken cancellationToken)
    {
        var parsed = ParseIds(ids);
        var map = await directory.ResolveDisplayNamesByAssigneeIdsAsync(parsed, cancellationToken);
        return Ok(map.Select(kv => new UserLabelDto { Id = kv.Key, DisplayName = kv.Value }).ToList());
    }

    [HttpGet("compensation")]
    public async Task<ActionResult<IdentityCompensationProfileDto>> Compensation(
        [FromQuery] string assigneeId,
        CancellationToken cancellationToken)
    {
        var dto = await directory.GetCompensationByAssigneeAsync(assigneeId, cancellationToken);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("user-id-by-assignee")]
    public async Task<ActionResult<IdentityUserIdDto>> UserIdByAssignee(
        [FromQuery] string assigneeId,
        CancellationToken cancellationToken)
    {
        var userId = await directory.ResolveUserIdForDistributionAssigneeAsync(
            assigneeId ?? "",
            cancellationToken);
        return string.IsNullOrWhiteSpace(userId)
            ? NotFound()
            : Ok(new IdentityUserIdDto { UserId = userId });
    }

    [HttpGet("user-id-by-email")]
    public async Task<ActionResult<IdentityUserIdDto>> UserIdByEmail(
        [FromQuery] string email,
        CancellationToken cancellationToken)
    {
        var userId = await directory.ResolveUserIdForEmailAsync(email ?? "", cancellationToken);
        return string.IsNullOrWhiteSpace(userId)
            ? NotFound()
            : Ok(new IdentityUserIdDto { UserId = userId });
    }

    [HttpGet("user-ids-by-assignees")]
    public async Task<ActionResult<IReadOnlyList<UserLabelDto>>> UserIdsByAssignees(
        [FromQuery] string ids,
        CancellationToken cancellationToken)
    {
        var parsed = ParseIds(ids);
        var map = await directory.ResolveUserIdsForDistributionAssigneesAsync(parsed, cancellationToken);
        return Ok(map.Select(kv => new UserLabelDto { Id = kv.Key, DisplayName = kv.Value }).ToList());
    }

    [HttpGet("user-ids-by-role")]
    public async Task<ActionResult<IdentityUserIdsDto>> UserIdsByRole(
        [FromQuery] string role,
        CancellationToken cancellationToken)
    {
        var userIds = await directory.ResolveUserIdsWithPrototypeRoleAsync(role ?? "", cancellationToken);
        return Ok(new IdentityUserIdsDto { UserIds = userIds });
    }

    private static List<string> ParseIds(string? ids) =>
        (ids ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(200)
            .ToList();
}
