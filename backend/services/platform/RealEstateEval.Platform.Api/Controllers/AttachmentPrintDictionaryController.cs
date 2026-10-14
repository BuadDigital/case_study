using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/attachment-print-dictionary")]
[Authorize]
public class AttachmentPrintDictionaryController : ControllerBase
{
    private readonly IAttachmentPrintDictionaryService _catalog;

    public AttachmentPrintDictionaryController(IAttachmentPrintDictionaryService catalog) =>
        _catalog = catalog;

    [HttpGet]
    public async Task<ActionResult<AttachmentPrintDictionaryDto>> Get(CancellationToken ct)
        => Ok(await _catalog.GetAsync(ct));
}
