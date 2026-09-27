using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Download: uploader, party-submission managers, or valuation / finance / operations
/// capabilities so report and billing flows keep working.
/// <see cref="PlatformCapabilities.ManageAttachments"/> only authorizes upload — every
/// field role holds it, so it must not bypass the uploader check (audit A-002).
/// Delete is narrower: the uploader, or case staff who manage party submissions.
/// </summary>
public static class AttachmentAccessRules
{
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
