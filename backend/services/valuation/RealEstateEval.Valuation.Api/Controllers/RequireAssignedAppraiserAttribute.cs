// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Access  New file — [RequireAssignedAppraiser] action filter: a valuation-work write is refused with 403
//            «تعديل التقييم للمقيّم المُسنَد للعقار فقط» unless the caller is the assigned appraiser; the
//            capability policy alone let any appraiser rewrite a colleague's valuation.
// Round 2 (1b19bedc)
//  • R2-6  When Case Study cannot be reached the filter answers 503 with
//          AssignedAppraiserMessages.UnverifiedAr (retry) instead of 403.
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
            var verdict = await assignedAppraisers.CheckRequestAsync(
                valuationRequestId, actor.UserId, actor.DistributionAssigneeId, ct);
            if (verdict == AssignedAppraiserVerdict.Unverified)
            {
                // Case Study did not answer: ask for a retry rather than telling the appraiser he is not assigned.
                context.Result = controller.ServiceUnavailableProblem(AssignedAppraiserMessages.UnverifiedAr);
                return;
            }
            if (verdict != AssignedAppraiserVerdict.Assigned)
            {
                context.Result = controller.ForbiddenProblem(ForbiddenAr);
                return;
            }
        }

        await next();
    }
}
