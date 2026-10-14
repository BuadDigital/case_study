using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Rules;

namespace RealEstateEval.Valuation.Api.Controllers;

[ApiController]
[Route("api/valuation-requests")]
[Authorize]
public class ValuationRequestsController : ControllerBase
{
    private readonly IValuationRequestService _service;
    private readonly IValuationIssuanceGateService _issuanceGates;

    public ValuationRequestsController(
        IValuationRequestService service,
        IValuationIssuanceGateService issuanceGates)
    {
        _service = service;
        _issuanceGates = issuanceGates;
    }

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<IReadOnlyList<ValuationRequestDto>>> List(CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    /// <summary>
    /// Map card facts — same payload as the operator queue, readable by case staff
    /// (<see cref="CapabilityPolicyNames.ReadValuationReport"/>). The queue page stays
    /// on <see cref="CapabilityPolicyNames.ReadValuationQueue"/>.
    /// </summary>
    [HttpGet("map-overlay")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<IReadOnlyList<ValuationRequestDto>>> MapOverlay(
        CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationRequestDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("open-by-property/{propertyId}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
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
            "property_id_required" => this.BadRequestProblem("معرّف العقار مطلوب"),
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
            "property_id_required" => this.BadRequestProblem("معرّف العقار مطلوب"),
            "valuation_already_open" => this.ConflictProblem(
                "an open valuation request already exists for this property"),
            "duplicate_display_id" => this.ConflictProblem("display id already in use"),
            _ => dto is null
                ? this.BadRequestProblem("تعذّر إنشاء طلب التقييم")
                : CreatedAtAction(nameof(Get), new { id = dto.Id }, dto),
        };
    }

    [HttpPost("{id:guid}/submit-report")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationRequestDto>> SubmitReport(Guid id, CancellationToken ct)
    {
        // Kept for one release (rolling deploys). The request now closes with the final issuance
        // (deposit code + certificate), which also feeds the comparables bank; this route only
        // answers for a request whose final copy is already issued.
        var (result, error) = await _service.SubmitReportAsync(id, ct);
        return error switch
        {
            "not_found" => this.NotFoundProblem("طلب التقييم غير موجود."),
            "already_submitted" => this.BadRequestProblem("report already submitted"),
            "final_issuance_required" => this.ConflictProblem(
                "يُغلق طلب التقييم بالإصدار النهائي: سجّل رمز الإيداع وأرفق الشهادة"),
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
            not null when error.StartsWith(ValuationReportFreezeRules.LockedErrorPrefix, StringComparison.Ordinal) =>
                this.ConflictProblem(error[ValuationReportFreezeRules.LockedErrorPrefix.Length..]),
            _ => Ok(result),
        };
    }
}
