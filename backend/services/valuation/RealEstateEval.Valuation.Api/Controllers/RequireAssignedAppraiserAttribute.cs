using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Shared.Web;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// A valuation-work write (comparables, approaches, cost, reconciliation, value documents) is the
/// assigned appraiser's only — the capability policy alone let any appraiser rewrite a colleague's
/// valuation. Reads the <c>valuationRequestId</c> route value.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
internal sealed class RequireAssignedAppraiserAttribute() : TypeFilterAttribute(typeof(AssignedAppraiserFilter));

internal sealed class AssignedAppraiserFilter(
    IAssignedAppraiserCheck assignedAppraisers,
    IPermissionService permissions) : IAsyncActionFilter
{
    public const string ForbiddenAr = "تعديل التقييم للمقيّم المُسنَد للعقار فقط";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var ct = context.HttpContext.RequestAborted;
        if (context.RouteData.Values.TryGetValue("valuationRequestId", out var raw)
            && Guid.TryParse(raw?.ToString(), out var valuationRequestId)
            && context.Controller is ControllerBase controller)
        {
            var actor = await ReportDraftActors.ResolveAsync(permissions, context.HttpContext.User, ct);
            if (!await assignedAppraisers.IsAssignedToRequestAsync(
                    valuationRequestId, actor.UserId, actor.DistributionAssigneeId, ct))
            {
                context.Result = controller.ForbiddenProblem(ForbiddenAr);
                return;
            }
        }

        await next();
    }
}
