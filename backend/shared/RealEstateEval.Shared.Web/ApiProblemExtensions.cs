using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Builds RFC 7807 <c>application/problem+json</c> responses for hand-written failures,
/// so controller errors look the same as the ones the framework and the global exception
/// handler emit.
/// </summary>
/// <remarks>
/// Each helper also copies the message into a legacy extension member
/// (<c>error</c> or <c>errors</c>). Extensions serialize as top-level JSON properties,
/// so existing clients reading <c>payload.error</c> keep working while new clients can
/// read the standard <c>detail</c>/<c>title</c>/<c>status</c> fields.
/// </remarks>
public static class ApiProblemExtensions
{
    /// <summary>Legacy single-message member kept for existing front-end callers.</summary>
    public const string LegacyErrorMember = "error";

    /// <summary>Legacy per-field member kept for existing front-end callers.</summary>
    public const string LegacyErrorsMember = "errors";

    public static ObjectResult BadRequestProblem(
        this ControllerBase controller,
        string detail,
        string title = "Bad Request") =>
        BuildProblem(controller, StatusCodes.Status400BadRequest, title, detail);

    public static ObjectResult NotFoundProblem(
        this ControllerBase controller,
        string detail,
        string title = "Not Found") =>
        BuildProblem(controller, StatusCodes.Status404NotFound, title, detail);

    public static ObjectResult ConflictProblem(
        this ControllerBase controller,
        string detail,
        string title = "Conflict") =>
        BuildProblem(controller, StatusCodes.Status409Conflict, title, detail);

    /// <summary>
    /// Per-field validation failure. <paramref name="errors"/> is surfaced both as the
    /// legacy <c>errors</c> map and as the standard problem <c>detail</c>.
    /// </summary>
    public static ObjectResult FieldErrorsProblem(
        this ControllerBase controller,
        IReadOnlyDictionary<string, string> errors,
        int statusCode = StatusCodes.Status400BadRequest,
        string title = "Bad Request")
    {
        var detail = errors.Count > 0
            ? string.Join(" ", errors.Values)
            : "الطلب غير صالح.";

        var result = BuildProblem(controller, statusCode, title, detail, includeLegacyError: false);
        ((ProblemDetails)result.Value!).Extensions[LegacyErrorsMember] =
            errors.ToDictionary(pair => pair.Key, pair => pair.Value);
        return result;
    }

    private static ObjectResult BuildProblem(
        ControllerBase controller,
        int statusCode,
        string title,
        string detail,
        bool includeLegacyError = true)
    {
        var result = controller.Problem(
            detail: detail,
            statusCode: statusCode,
            title: title);

        if (includeLegacyError && result.Value is ProblemDetails problem)
            problem.Extensions[LegacyErrorMember] = detail;

        return result;
    }
}
