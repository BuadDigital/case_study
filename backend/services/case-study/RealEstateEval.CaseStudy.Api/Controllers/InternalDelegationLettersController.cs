using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/internal-delegation-letters")]
[Authorize]
public class InternalDelegationLettersController : ControllerBase
{
    private readonly IInternalDelegationLettersService _letters;

    public InternalDelegationLettersController(IInternalDelegationLettersService letters)
        => _letters = letters;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InternalDelegationLetterDto>>> Get(
        [FromQuery] string? scopeKey,
        [FromQuery] string? poNumber,
        CancellationToken ct)
    {
        // توافق مؤقت: poNumber يُعامل كـ scopeKey إن لم يُمرَّر scopeKey.
        var key = (scopeKey ?? poNumber ?? "").Trim();
        if (key.Length == 0)
            return BadRequest(new { error = "scopeKey is required" });

        return Ok(await _letters.GetForScopeAsync(key, ct));
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<IReadOnlyList<InternalDelegationLetterDto>>> Save(
        [FromBody] SaveInternalDelegationLettersRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ScopeKey))
            return BadRequest(new { error = "scopeKey is required" });

        return Ok(await _letters.SaveAsync(request, ct));
    }

    [HttpPost("issue")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<InternalDelegationLetterDto>> Issue(
        [FromBody] IssueInternalDelegationLetterRequest request,
        CancellationToken ct)
    {
        var (letter, error) = await _letters.IssueAsync(request, ct);
        if (error is not null) return BadRequest(new { error });
        return Ok(letter);
    }
}
