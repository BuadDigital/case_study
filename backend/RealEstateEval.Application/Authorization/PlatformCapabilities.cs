namespace RealEstateEval.Application.Authorization;

/// <summary>Server capability names (aligned with <c>PlatformPermissionCatalog.AllCapabilities</c>).</summary>
public static class PlatformCapabilities
{
    public const string ClaimType = "capability";

    public const string ManageUsers = "manage-users";
    public const string ManageSystemConfig = "manage-system-config";
    public const string ResetSystemData = "reset-system-data";
    public const string ManageValuationRequests = "manage-valuation-requests";
    public const string ManageFailures = "manage-failures";
    public const string SubmitValuationReport = "submit-valuation-report";
    public const string ManageWorkOrders = "manage-work-orders";
    public const string SubmitPartyWork = "submit-party-work";
    public const string ManageAttachments = "manage-attachments";
    public const string ManageFinancial = "manage-financial";
    public const string ManageOperations = "manage-operations";
    public const string Authenticated = "authenticated";

    public static readonly IReadOnlyList<string> All =
    [
        ManageUsers,
        ManageSystemConfig,
        ResetSystemData,
        ManageValuationRequests,
        ManageFailures,
        SubmitValuationReport,
        ManageWorkOrders,
        SubmitPartyWork,
        ManageAttachments,
        ManageFinancial,
        ManageOperations,
    ];
}
