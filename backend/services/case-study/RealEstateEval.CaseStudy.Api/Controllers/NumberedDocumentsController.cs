using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// Numbered Document Register (Decision 25 + Numbering Workshop): Assignment of Letter Numbers (LT)
/// Case Study (CS) reports are instant printing and reading history.
/// </summary>
[ApiController]
[Route("api/numbered-documents")]
[Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
public class NumberedDocumentsController : ControllerBase
{
    private readonly INumberedDocumentService _documents;

    public NumberedDocumentsController(INumberedDocumentService documents) =>
        _documents = documents;

    [HttpPost]
    public async Task<ActionResult<NumberedDocumentDto>> Allocate(
        [FromBody] AllocateNumberedDocumentRequest request,
        CancellationToken ct)
    {
        var userId = ActorClaims.TryId(User);
        if (userId is null) return Unauthorized();

        var (result, error) = await _documents.AllocateAsync(request, userId, ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NumberedDocumentDto>>> List(
        [FromQuery] string? kind,
        [FromQuery] string? poNumber,
        CancellationToken ct) =>
        Ok(await _documents.ListAsync(kind, poNumber, ct));
}
