using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// سجل المستندات المرقّمة (قرار 25 + ورشة الترقيم): تخصيص أرقام الخطابات (LT)
/// وتقارير دراسة الحالة (CS) لحظة الطباعة، وقراءة السجل.
/// </summary>
[ApiController]
[Route("api/numbered-documents")]
[Authorize]
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
