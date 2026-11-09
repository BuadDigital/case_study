using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// The reopenings not closed yet (Omar 2026-11-05) — «أعمالي» reads them for coordination's «الرد على إنفاذ»
/// rows and the «معاد فتحها» chip on a reopened transaction's rows.
/// </summary>
[ApiController]
[Route("api/transaction-reopenings")]
[Authorize]
public class TransactionReopeningsController(ITransactionStateService state) : ControllerBase
{
    [HttpGet("active")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<IReadOnlyList<TransactionReopeningDto>>> Active(CancellationToken ct) =>
        Ok(await state.ListActiveReopeningsAsync(ct));
}
