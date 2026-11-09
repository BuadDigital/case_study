using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

/// <summary>
/// «سجل تعديلات البيانات» of one property — the field change log the case-study service appends
/// on every save of property data (ruling 2026-11-02: every case-specialist sub-role and the
/// appraiser edit, and management watches the trail).
/// </summary>
/// <remarks>
/// How it works: the same audit ledger as the CDO's audit screen, narrowed to one action and one
/// property, newest first. Edge cases: the inspector and the engineering office (who never edit
/// property data) are refused even though their capability reaches the door; a bad page or
/// limit is clamped by the query service.
/// </remarks>
[ApiController]
[Route("api/audit-log/property-changes")]
[Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
public sealed class PropertyChangeLogController(
    IAuditLogQueryService auditLog,
    IPermissionService permissions) : ControllerBase
{
    private const string Action = "case-study.property.fields-changed";
    private const string EntityType = "WorkOrderProperty";

    [HttpGet("{propertyId:guid}")]
    public async Task<ActionResult<AuditLogPageDto>> List(
        Guid propertyId,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var actor = await permissions.GetForUserIdAsync(ActorClaims.Id(User), cancellationToken);
        if (!CanRead(StaffActor.From(actor)))
            return this.ForbiddenProblem("سجل تعديلات البيانات لفريق دراسة الحالة والمقيّم والإدارة");

        return Ok(await auditLog.ListAsync(
            EntityType,
            propertyId.ToString("D"),
            Action,
            actorId: null,
            page,
            limit,
            cancellationToken));
    }

    /// <summary>Who reads the trail: whoever may edit property data, plus the supervisors and the GM.</summary>
    private static bool CanRead(StaffActor actor) =>
        PoRoleMatrixRules.CanEditPropertyData(actor)
        || PoRoleMatrixRules.CanManagePartySubmissions(actor.Role);
}
