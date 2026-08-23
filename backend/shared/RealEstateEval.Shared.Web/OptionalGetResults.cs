using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Optional satellite GETs (drafts, lookups): "nothing saved yet" is 200 + JSON null,
/// not 404. 404 stays for unknown parents and authorization hiding.
/// </summary>
public static class OptionalGetResults
{
    public static ActionResult<T> OkOrEmpty<T>(this ControllerBase _, T? value)
        where T : class =>
        value is null
            ? new JsonResult(null) { StatusCode = StatusCodes.Status200OK }
            : new OkObjectResult(value);
}
