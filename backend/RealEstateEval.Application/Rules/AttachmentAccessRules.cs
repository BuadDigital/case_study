using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Same access check as attachment download: uploader, party-submission managers,
/// or the manage-attachments capability. Valuation, finance, and operations
/// capabilities may also read so report and billing flows keep working.
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

        return !string.IsNullOrWhiteSpace(actor.UserId)
            && string.Equals(uploadedByUserId, actor.UserId, StringComparison.Ordinal);
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

    private static bool HasOperationalReadCapability(PermissionsDto actor) =>
        actor.Capabilities.Contains(PlatformCapabilities.ManageAttachments, StringComparer.Ordinal)
        || actor.Capabilities.Contains(PlatformCapabilities.ManageValuationRequests, StringComparer.Ordinal)
        || actor.Capabilities.Contains(PlatformCapabilities.SubmitValuationReport, StringComparer.Ordinal)
        || actor.Capabilities.Contains(PlatformCapabilities.ManageFinancial, StringComparer.Ordinal)
        || actor.Capabilities.Contains(PlatformCapabilities.ManageOperations, StringComparer.Ordinal);
}
