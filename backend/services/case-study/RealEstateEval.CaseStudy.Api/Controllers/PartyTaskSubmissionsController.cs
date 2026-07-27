using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Permissions;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/party-task-submissions")]
[Authorize]
public class PartyTaskSubmissionsController : ControllerBase
{
    private readonly IPartyTaskSubmissionService _submissions;
    private readonly ApplicationDbContext _db;

    public PartyTaskSubmissionsController(
        IPartyTaskSubmissionService submissions,
        ApplicationDbContext db)
    {
        _submissions = submissions;
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PartyTaskSubmissionDto>>> List(
        [FromQuery] string? workflowTaskIds,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(workflowTaskIds))
            return Ok(Array.Empty<PartyTaskSubmissionDto>());

        var ids = workflowTaskIds
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => Guid.TryParse(s, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToList();

        return Ok(await _submissions.ListForTasksAsync(ids, cancellationToken));
    }

    [HttpGet("{taskId:guid}")]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Get(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dto = await _submissions.GetAsync(taskId, cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPut("{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> SaveDraft(
        Guid taskId,
        [FromBody] SavePartyTaskSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.SaveDraftAsync(
            taskId,
            request,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToActionResult(result, errors);
    }

    [HttpPost("{taskId:guid}/submit")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Submit(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.SubmitAsync(
            taskId,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToActionResult(result, errors);
    }

    [HttpPost("{taskId:guid}/reopen")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Reopen(
        Guid taskId,
        [FromBody] ReopenPartyTaskSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.ReopenAsync(
            taskId,
            request,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToActionResult(result, errors);
    }

    [HttpPost("{taskId:guid}/accept")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Accept(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.AcceptAsync(
            taskId,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToActionResult(result, errors);
    }

    private ActionResult<PartyTaskSubmissionDto> ToActionResult(
        PartyTaskSubmissionDto? result,
        Dictionary<string, string>? errors)
    {
        if (errors is not null)
        {
            if (errors.TryGetValue("_", out var msg)
                && msg.Contains("صلاحية", StringComparison.Ordinal))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { errors });
            }
            return BadRequest(new { errors });
        }
        return Ok(result);
    }

    private async Task<PartySubmissionActor> ResolveActorAsync(CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        var profile = string.IsNullOrWhiteSpace(userId) || userId == "unknown"
            ? null
            : await _db.UserProfiles.AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        var identityRoles = string.IsNullOrWhiteSpace(userId) || userId == "unknown"
            ? new List<string>()
            : await (
                from ur in _db.UserRoles.AsNoTracking()
                join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
                where ur.UserId == userId
                select r.Name!
            ).ToListAsync(ct);

        return new PartySubmissionActor
        {
            UserId = userId == "unknown" ? "" : userId,
            DisplayName = ActorClaims.DisplayName(User),
            PrototypeRole = PrototypeRoleResolver.Resolve(profile, identityRoles),
            DistributionAssigneeId = profile?.DistributionAssigneeId?.Trim(),
        };
    }
}
