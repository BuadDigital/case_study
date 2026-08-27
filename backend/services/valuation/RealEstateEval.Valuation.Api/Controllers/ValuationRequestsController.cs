using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Api.Controllers;

[ApiController]
[Route("api/valuation-requests")]
[Authorize]
public class ValuationRequestsController : ControllerBase
{
    private readonly IValuationRequestService _service;
    private readonly IValuationIssuanceGateService _issuanceGates;
    private readonly IPriorValuationBankFeeder _bankFeeder;

    public ValuationRequestsController(
        IValuationRequestService service,
        IValuationIssuanceGateService issuanceGates,
        IPriorValuationBankFeeder bankFeeder)
    {
        _service = service;
        _issuanceGates = issuanceGates;
        _bankFeeder = bankFeeder;
    }

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<IReadOnlyList<ValuationRequestDto>>> List(CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationRequestDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("open-by-property/{propertyId}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationRequestDto>> GetOpenByProperty(
        string propertyId,
        CancellationToken ct)
    {
        var dto = await _service.GetOpenByPropertyAsync(propertyId, ct);
        return this.OkOrEmpty(dto);
    }

    [HttpPost("ensure-open")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationRequestDto>> EnsureOpen(
        [FromBody] SaveValuationRequestRequest request,
        CancellationToken ct)
    {
        var (dto, error) = await _service.EnsureOpenByPropertyAsync(request, ct);
        return error switch
        {
            "valuation_already_open" => this.ConflictProblem(
                "an open valuation request already exists for this property"),
            "duplicate_display_id" => this.ConflictProblem("display id already in use"),
            _ => dto is null ? this.BadRequestProblem("تعذّر فتح طلب التقييم") : Ok(dto),
        };
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageValuationRequests)]
    public async Task<ActionResult<ValuationRequestDto>> Create(
        [FromBody] SaveValuationRequestRequest request,
        CancellationToken ct)
    {
        var (dto, error) = await _service.CreateAsync(request, ct);
        return error switch
        {
            "valuation_already_open" => this.ConflictProblem(
                "an open valuation request already exists for this property"),
            "duplicate_display_id" => this.ConflictProblem("display id already in use"),
            _ => CreatedAtAction(nameof(Get), new { id = dto!.Id }, dto),
        };
    }

    [HttpPost("{id:guid}/submit-report")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationRequestDto>> SubmitReport(Guid id, CancellationToken ct)
    {
        var gates = await _issuanceGates.EvaluateAsync(id, ct);
        if (gates is null) return this.NotFoundProblem("طلب التقييم غير موجود.");
        if (!gates.AllowsIssuance)
        {
            return this.BadRequestProblem("تعذّر إصدار التقرير — بوابات الإصدار غير مكتملة")
                .WithProblemExtension("code", "issuance_blocked")
                .WithProblemExtension("blockingReasons", gates.BlockingReasonsAr);
        }

        var (result, error) = await _service.SubmitReportAsync(id, ct);
        if (error is null)
        {
 // the completed valuation feeds the shared bank («تقييم سابق»).
 // Best-effort: harvest failure must never fail the submit itself.
            try
            {
                await _bankFeeder.FeedAsync(id, ct);
            }
            catch (Exception)
            {
 // Missing bank inputs (coords/value/area) skip quietly inside the
 // feeder; anything else is non-fatal to report submission.
            }
        }

        return error switch
        {
            "not_found" => this.NotFoundProblem("طلب التقييم غير موجود."),
            "already_submitted" => this.BadRequestProblem("report already submitted"),
            _ => Ok(result),
        };
    }

    [HttpGet("{id:guid}/issuance-gates")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationIssuanceGatesDto>> GetIssuanceGates(
        Guid id,
        CancellationToken ct)
    {
        var dto = await _issuanceGates.EvaluateAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{id:guid}/impediment")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationRequestDto>> RecordImpediment(
        Guid id,
        [FromBody] ValuationImpedimentRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _service.RecordImpedimentAsync(id, request, ct);
        return error switch
        {
            "not_found" => this.NotFoundProblem("طلب التقييم غير موجود."),
            "already_submitted" => this.BadRequestProblem("report already submitted"),
            "already_impeded" => this.BadRequestProblem("impediment already recorded"),
            "reason_required" => this.BadRequestProblem("reason is required"),
            _ => Ok(result),
        };
    }
}
