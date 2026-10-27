using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Abstractions;
namespace RealEstateEval.Failures.Api.Controllers;

[ApiController]
[Route("api/failures")]
[Authorize]
public class FailuresController : ControllerBase
{
    private readonly IFailureService _failures;
    private readonly IPermissionService _permissions;
    private readonly DatabaseOptions _dbOptions;

    public FailuresController(
        IFailureService failures,
        IPermissionService permissions,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _failures = failures;
        _permissions = permissions;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

 /// <summary>
 /// Failures queue. Sending page or pageSize returns PagedResultDto; without them the response
 /// stays the plain array every existing caller expects.
 /// See docs/architecture/pagination-contract.md.
 /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? sort,
        [FromQuery] string? dir,
        [FromQuery] string? q,
        [FromQuery] string? status,
        [FromQuery] string? poNumber,
        [FromQuery] string? problemTypeId,
        CancellationToken cancellationToken)
    {
        var actor = await ActorAsync(cancellationToken);
        var query = new FailureListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            Status = status,
            PoNumber = poNumber,
            ProblemTypeId = problemTypeId,
        };

        if (!query.IsPaged)
            return Ok(await _failures.ListAsync(query, actor, cancellationToken));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page,
            query.PageSize,
            _dbOptions);
        return Ok(await _failures.ListPagedAsync(
            query, actor, skip, take, resolvedPage, cancellationToken));
    }

    [HttpGet("property")]
    public async Task<ActionResult<FailureRecordDto>> GetForProperty(
        [FromQuery] string poNumber,
        [FromQuery] string propertyId,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.GetActiveForPropertyAsync(
            poNumber,
            propertyId,
            await ActorAsync(cancellationToken),
            cancellationToken);
        return this.OkOrEmpty(dto);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.RaiseFailures)]
    public async Task<ActionResult<FailureRecordDto>> Create(
        [FromBody] CreateFailureRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _failures.CreateAsync(
            request,
            ActorClaims.Id(User),
            cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("bourse-obstruction")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> ReportBourseObstruction(
        [FromBody] BourseObstructionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _failures.ReportBourseObstructionAsync(request, cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("{id:guid}/upgrade")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Upgrade(
        Guid id,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.UpgradeToInternalAsync(id, cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن ترقية هذا التعذّر");
        return Ok(dto);
    }

    /// <summary>
    /// «تصعيد إلى المشرف». How it works: the body's <c>note</c> is the specialist's explanation,
    /// stored on the failure as «سبب التصعيد». Edge cases: a missing or blank note is a 400 from
    /// the note validator before the service runs (the body used to be empty); an illegal
    /// transition answers 400 «لا يمكن إرسال هذا التعذّر للمراجعة».
    /// </summary>
    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Submit(
        Guid id,
        [FromBody] FailureNoteRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.SubmitForReviewAsync(id, request.Note, cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن إرسال هذا التعذّر للمراجعة");
        return Ok(dto);
    }

    [HttpPost("{id:guid}/suspend")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Suspend(
        Guid id,
        [FromBody] FailureNoteRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.SuspendAsync(id, request.Note, ActorClaims.Id(User), cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن تعليق هذا التعذّر");
        return Ok(dto);
    }

    [HttpPost("{id:guid}/resolve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Resolve(
        Guid id,
        [FromBody] ResolveFailureRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.ResolveAsync(
            id,
            request,
            ActorClaims.Id(User),
            cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن حل هذا التعذّر — تغيّرت حالته أو لم يعد موجوداً، حدّث الصفحة");
        return Ok(dto);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Approve(
        Guid id,
        [FromBody] FailureNoteRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.ApproveAsync(
            id,
            request.Note,
            ActorClaims.Id(User),
            cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن اعتماد هذا التعذّر");
        return Ok(dto);
    }

    /// <summary>
    /// «التعذر النهائي عن المعاملة» — the section supervisor (or the CDO) only: every live deed of
    /// the transaction turns final, the parties told only when <c>notifyParties</c> is set.
    /// How it works: the role comes from the caller's permissions, not the token, and is checked
    /// with <c>FailureRecordRules.CanRecordFinalFailure</c> before the service runs.
    /// Edge cases: a specialist passes the <c>manage-failures</c> policy but gets 403 here; field
    /// errors (reason, problem type, already final) come back as a 400 keyed by field.
    /// </summary>
    [HttpPost("final")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<IReadOnlyList<FailureRecordDto>>> RecordFinal(
        [FromBody] FinalFailureRequest request,
        CancellationToken cancellationToken)
    {
        var role = (await ActorAsync(cancellationToken))?.PrototypeRole;
        if (!FailureRecordRules.CanRecordFinalFailure(role))
            return this.ForbiddenProblem("التعذّر النهائي عن المعاملة للمشرف فقط");

        var (result, errors) = await _failures.RecordFinalFailureAsync(
            request,
            ActorClaims.Id(User),
            cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("{id:guid}/return")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Return(
        Guid id,
        [FromBody] FailureNoteRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.ReturnAsync(
            id,
            request.Note,
            ActorClaims.Id(User),
            cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن إعادة هذا التعذّر");
        return Ok(dto);
    }

    /// <summary>
    /// Lifts the engineering-survey freeze every active failure of the property puts on the survey
    /// work; the failures themselves stay active. Any case specialist, by role (403 otherwise).
    /// Idempotent — answers <c>{ lifted: n }</c> with the failures this call lifted.
    /// </summary>
    [HttpPost("by-property/lift-survey-freeze")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<LiftSurveyFreezeResultDto>> LiftSurveyFreeze(
        [FromBody] LiftSurveyFreezeRequest request,
        CancellationToken cancellationToken)
    {
        var actor = await ActorAsync(cancellationToken);
        if (!PoRoleMatrixRules.CanLiftSurveyFreeze(actor?.PrototypeRole))
            return this.ForbiddenProblem(FailureRecordRules.LiftSurveyFreezeRoleDeniedAr);

        var (result, errors) = await _failures.LiftSurveyFreezeAsync(
            request ?? new LiftSurveyFreezeRequest(),
            ActorClaims.Id(User),
            actor?.PrototypeRole,
            cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpDelete("by-po/{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<IActionResult> DeleteForPo(
        string poNumber,
        CancellationToken cancellationToken)
    {
        await _failures.DeleteForPoAsync(poNumber, cancellationToken);
        return NoContent();
    }

    private async Task<PermissionsDto?> ActorAsync(CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId) || userId == "unknown")
            return null;
        return await _permissions.GetForUserIdAsync(userId, cancellationToken);
    }
}
