using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/case-study-forms")]
[Authorize]
public class CaseStudyFormsController : ControllerBase
{
    private readonly ICaseStudyFormService _forms;

    public CaseStudyFormsController(ICaseStudyFormService forms)
    {
        _forms = forms;
    }

    [HttpGet("{taskId:guid}")]
    public async Task<ActionResult<CaseStudyFormDto>> Get(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dto = await _forms.GetAsync(taskId, party: false, cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPut("{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<CaseStudyFormDto>> Save(
        Guid taskId,
        [FromBody] SaveCaseStudyFormRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _forms.SaveAsync(
            taskId,
            party: false,
            request.Form,
            cancellationToken);
        if (errors is not null) return BadRequest(new { errors });
        return Ok(result);
    }

    [HttpGet("party/{taskId:guid}")]
    public async Task<ActionResult<CaseStudyFormDto>> GetParty(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dto = await _forms.GetAsync(taskId, party: true, cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPut("party/{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<CaseStudyFormDto>> SaveParty(
        Guid taskId,
        [FromBody] SaveCaseStudyFormRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _forms.SaveAsync(
            taskId,
            party: true,
            request.Form,
            cancellationToken);
        if (errors is not null) return BadRequest(new { errors });
        return Ok(result);
    }
}
