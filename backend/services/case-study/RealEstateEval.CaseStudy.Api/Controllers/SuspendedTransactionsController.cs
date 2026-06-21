using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/suspended-transactions")]
[Authorize]
public class SuspendedTransactionsController : ControllerBase
{
    private readonly ISuspendedTransactionsService _suspended;

    public SuspendedTransactionsController(ISuspendedTransactionsService suspended)
        => _suspended = suspended;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SuspendedTransactionDto>>> List(CancellationToken ct)
        => Ok(await _suspended.ListAsync(ct));
}
