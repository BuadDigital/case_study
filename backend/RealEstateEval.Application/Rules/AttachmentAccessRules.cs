using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Download: uploader, party-submission managers, or valuation / finance / operations
/// capabilities so report and billing flows keep working.
/// <see cref="PlatformCapabilities.ManageAttachments"/> only authorizes upload — every
/// field role holds it, so it must not bypass the uploader check (audit A-002).
/// Delete is narrower: the uploader, or case staff who manage party submissions.
/// A «مستند ذو قيمة» is stricter: only the case specialist, the appraiser and the CDO see it — plus its
/// own uploader (so they can preview what they uploaded). Deleting stays with the specialist / CDO and a
/// seeing uploader.
/// </summary>
public static class AttachmentAccessRules
{
    /// <summary>Read rule that knows the row's document type (valued documents are restricted).</summary>
    public static bool Allows(string uploadedByUserId, string? documentTypeKey, PermissionsDto? actor) =>
        PropertyDocumentTypes.IsValued(documentTypeKey)
            ? AllowsValuedDocument(actor) || (actor is not null && IsUploader(uploadedByUserId, actor))
            : Allows(uploadedByUserId, actor);

    public static bool AllowsDelete(string uploadedByUserId, string? documentTypeKey, PermissionsDto? actor)
    {
        if (!PropertyDocumentTypes.IsValued(documentTypeKey))
            return AllowsDelete(uploadedByUserId, actor);
        if (actor is null) return false;
        return PoRoleMatrixRules.CanReviewValuedDocuments(actor.PrototypeRole)
            || (AllowsValuedDocument(actor) && IsUploader(uploadedByUserId, actor));
    }

    public static bool AllowsValuedDocument(PermissionsDto? actor) =>
        actor is not null && PoRoleMatrixRules.CanSeeValuedDocuments(actor.PrototypeRole);

    public static bool Allows(string uploadedByUserId, PermissionsDto? actor)
    {
        if (actor is null)
            return false;

        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return true;

        if (HasOperationalReadCapability(actor))
            return true;

        return IsUploader(uploadedByUserId, actor);
    }

    public static bool AllowsDelete(string uploadedByUserId, PermissionsDto? actor)
    {
        if (actor is null)
            return false;

        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return true;

        return IsUploader(uploadedByUserId, actor);
    }

    /// <summary>
    /// Property listings match the property id exactly, or a delimited prefix
    /// (<c>{id}:…</c> / <c>{id}/…</c>) — never a raw substring.
    /// </summary>
    public static bool ScopeKeyMatchesProperty(string scopeKey, string propertyId)
    {
        var key = scopeKey.Trim();
        var id = propertyId.Trim();
        if (id.Length == 0)
            return false;

        return string.Equals(key, id, StringComparison.Ordinal)
            || key.StartsWith(id + ":", StringComparison.Ordinal)
            || key.StartsWith(id + "/", StringComparison.Ordinal);
    }

    private static bool IsUploader(string uploadedByUserId, PermissionsDto actor) =>
        !string.IsNullOrWhiteSpace(actor.UserId)
        && string.Equals(uploadedByUserId, actor.UserId, StringComparison.Ordinal);

    private static bool HasOperationalReadCapability(PermissionsDto actor) =>
        actor.Capabilities.Contains(PlatformCapabilities.ManageValuationRequests, StringComparer.Ordinal)
        || actor.Capabilities.Contains(PlatformCapabilities.SubmitValuationReport, StringComparer.Ordinal)
        || actor.Capabilities.Contains(PlatformCapabilities.ManageFinancial, StringComparer.Ordinal)
        || actor.Capabilities.Contains(PlatformCapabilities.ManageOperations, StringComparer.Ordinal);
}
