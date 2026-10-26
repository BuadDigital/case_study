using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Attachments.Application.Contracts;
using RealEstateEval.Attachments.Application.Abstractions;

namespace RealEstateEval.Attachments.Api.Controllers;

[ApiController]
[Route("api/attachments")]
[Authorize]
public class AttachmentsController : ControllerBase
{
    public const string ScopeRequiredAr = "نطاق المرفقات ومفتاحه مطلوبان (scope و scopeKey)";
    public const string ScopeKeyRequiredAr = "مفتاح نطاق المرفقات مطلوب (scopeKey)";

    private readonly IAttachmentService _attachments;
    private readonly IAttachmentLookup _lookup;
    private readonly IPermissionService _permissions;
    private readonly ILogger<AttachmentsController> _logger;
    public AttachmentsController(
        IAttachmentService attachments,
        IAttachmentLookup lookup,
        IPermissionService permissions,
        ILogger<AttachmentsController> logger)
    {
        _attachments = attachments;
        _lookup = lookup;
        _permissions = permissions;
        _logger = logger;
    }

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<IReadOnlyList<FileAttachmentMetaDto>>> List(
        [FromQuery] string? scope,
        [FromQuery] string? scopeKey,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(scope) || string.IsNullOrWhiteSpace(scopeKey))
            return this.BadRequestProblem(ScopeRequiredAr);

        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(await _attachments.ListAsync(scope, scopeKey, actor, ct));
    }

    /// <summary>What the uploader of a «مستند ذو قيمة» still sees of it: name and status, never the file.</summary>
    [HttpGet("own-valued-documents")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<IReadOnlyList<OwnValuedDocumentDto>>> OwnValuedDocuments(
        [FromQuery] string? scopeKey,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(scopeKey))
            return this.BadRequestProblem(ScopeKeyRequiredAr);

        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(await _attachments.ListOwnValuedDocumentsAsync(scopeKey, actor, ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        var (content, meta) = await _attachments.GetContentAsync(id, actor, ct);
        if (content is null || meta is null) return NotFound();
        return File(content, meta.ContentType, meta.FileName);
    }

    [HttpGet("{id:guid}/meta")]
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> GetMeta(Guid id, CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        var meta = await _attachments.GetMetaAsync(id, actor, ct);
        return meta is null ? NotFound() : Ok(meta);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> Upload(
        [FromBody] UploadAttachmentRequest request,
        CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        if (userId is "unknown") userId = "";

        var valued = string.Equals(request.Scope?.Trim(), PropertyDocumentTypes.ValuedScope, StringComparison.Ordinal)
            || PropertyDocumentTypes.IsValued(request.DocumentTypeKey);
        if (valued)
        {
            var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
            if (!PoRoleMatrixRules.CanUploadValuedDocuments(actor?.PrototypeRole))
                return this.ForbiddenProblem("لا تملك صلاحية رفع مستند ذي قيمة");
        }
        else if (string.Equals(request.Scope?.Trim(), PropertyDocumentTypes.GovernedScope, StringComparison.Ordinal))
        {
            var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
            if (!PoRoleMatrixRules.CanUploadPropertyDocuments(actor?.PrototypeRole))
                return this.ForbiddenProblem("رفع مستندات العقار متاح للأخصائي ومشرف القسم");
        }

        var (meta, error) = await _attachments.UploadAsync(request, userId, ct);
        if (error is not null)
        {
            _logger.LogInformation(
                "Rejected attachment upload for scope {Scope} by user {UserId}: {Reason}",
                request.Scope,
                userId,
                error);
            return this.BadRequestProblem(error);
        }

        return CreatedAtAction(nameof(Download), new { id = meta!.Id }, meta);
    }

    [HttpPut("{id:guid}/document-type")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> SetDocumentType(
        Guid id,
        [FromBody] SetAttachmentDocumentTypeRequest request,
        CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (!PoRoleMatrixRules.CanUploadPropertyDocuments(actor?.PrototypeRole))
            return this.ForbiddenProblem("تصنيف مستندات العقار متاح للأخصائي ومشرف القسم");

        var (meta, error) = await _attachments.SetDocumentTypeAsync(id, request, actor, ct);
        if (error is not null) return this.BadRequestProblem(error);
        return meta is null ? NotFound() : Ok(meta);
    }

    /// <summary>The case specialist approves or rejects a «مستند ذو قيمة».</summary>
    [HttpPost("{id:guid}/value-document-review")]
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
    public async Task<ActionResult<FileAttachmentMetaDto>> ReviewValueDocument(
        Guid id,
        [FromBody] ReviewValueDocumentRequest request,
        CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (!PoRoleMatrixRules.CanReviewValuedDocuments(actor?.PrototypeRole))
            return this.ForbiddenProblem("اعتماد المستندات ذات القيمة متاح لأخصائي دراسة الحالة");

        var (meta, error) = await _attachments.ReviewValueDocumentAsync(id, request, actor, ct);
        if (error is not null) return this.BadRequestProblem(error);
        return meta is null ? NotFound() : Ok(meta);
    }

    /// <summary>
    /// References of the given ids. A person sees only the rows they may read; the service's own
    /// token (a payload check behind a save) sees every row, as the in-process lookup does.
    /// </summary>
    /// <remarks>
    /// How it works: parses the comma-separated ids; a caller holding the upstream-service token gets
    /// <c>GetRefsAsync(ids, actor: null)</c> (unfiltered); anyone else is resolved to their permissions
    /// and gets only the rows they may read. Returns references only (id, scope, scope key — never files).
    /// Edge case fixed 2026-10-21 (prod PO-067455): the inspector's resend failed «مرفق صورة غير موجود في
    /// قاعدة البيانات» because the check ran with the inspector's token and inspection photos are readable
    /// by uploader/manager only, so the specialist's photo was hidden. Fix: policy CheckAttachmentRefs
    /// (readers + service token) and the unfiltered service branch. In-process (dev) never failed, since
    /// actor = null already skipped filtering there.
    /// </remarks>
    [HttpGet("lookup")]
    [Authorize(Policy = CapabilityPolicyNames.CheckAttachmentRefs)]
    public async Task<ActionResult<IReadOnlyList<AttachmentRefDto>>> Lookup(
        [FromQuery] string ids,
        CancellationToken ct)
    {
        var parsed = ParseIds(ids);
        if (IsServiceCaller()) return Ok(await _lookup.GetRefsAsync(parsed, actor: null, ct));
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(await _lookup.GetRefsAsync(parsed, actor, ct));
    }

    // Decision 2026-10-21: a system check (actor = null) — e.g. a photo the specialist added to a
    // returned inspection must not be reported «missing» to the inspector who cannot read it.
    private bool IsServiceCaller() =>
        User.HasClaim(PlatformCapabilities.TokenUseClaimType, PlatformCapabilities.UpstreamServiceTokenUse);

    [HttpGet("for-property")]
    [Authorize(Policy = CapabilityPolicyNames.ReadAttachments)]
    public async Task<ActionResult<IReadOnlyList<FileAttachmentMetaDto>>> ForProperty(
        [FromQuery] string propertyId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(propertyId))
            return this.BadRequestProblem("معرّف العقار مطلوب");

        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(await _lookup.ListForPropertyAsync(propertyId, actor, ct));
    }

    /// <summary>Whether one attachment exists — for the caller, or at all for the service's own token.</summary>
    /// <remarks>
    /// How it works: an upstream-service caller gets <c>ExistsAsync(id, actor: null)</c>, which ignores read
    /// rights; any other caller is resolved to their permissions and gets "exists and I may read it".
    /// Returns { Exists } only, never the file.
    /// Edge case fixed 2026-10-21: same cause as <see cref="Lookup"/> — a system payload check must not report
    /// a photo «missing» just because the person saving cannot open it; the policy moved from
    /// ReadAttachments to CheckAttachmentRefs so the service token (no capability claims) is let in.
    /// </remarks>
    [HttpGet("{id:guid}/exists")]
    [Authorize(Policy = CapabilityPolicyNames.CheckAttachmentRefs)]
    public async Task<ActionResult<AttachmentExistsDto>> Exists(Guid id, CancellationToken ct)
    {
        if (IsServiceCaller())
            return Ok(new AttachmentExistsDto { Exists = await _lookup.ExistsAsync(id, actor: null, ct) });
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return Ok(new AttachmentExistsDto { Exists = await _lookup.ExistsAsync(id, actor, ct) });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageAttachments)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        return await _attachments.DeleteAsync(id, actor, ct) ? NoContent() : NotFound();
    }

    private static IReadOnlyList<Guid> ParseIds(string? ids)
    {
        if (string.IsNullOrWhiteSpace(ids))
            return [];

        return ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => Guid.TryParse(part, out var id) ? id : (Guid?)null)
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .Distinct()
            .Take(200)
            .ToList();
    }
}