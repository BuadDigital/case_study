using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Shared.Web.Authorization;

public static class CapabilityPolicyNames
{
    public const string ManageUsers = "Capability:manage-users";
    public const string ManageSystemConfig = "Capability:manage-system-config";
    public const string ResetSystemData = "Capability:reset-system-data";
    public const string ManageValuationRequests = "Capability:manage-valuation-requests";
    public const string ManageFailures = "Capability:manage-failures";
    public const string SubmitValuationReport = "Capability:submit-valuation-report";
    public const string ManageWorkOrders = "Capability:manage-work-orders";
    public const string SubmitPartyWork = "Capability:submit-party-work";
    public const string ManageAttachments = "Capability:manage-attachments";
    public const string ManageFinancial = "Capability:manage-financial";
    public const string ManageOperations = "Capability:manage-operations";
    public const string ManageCourts = "Capability:courts.manage";

    /// <summary>Party workspaces raise failures; case staff manage the full queue.</summary>
    public const string RaiseFailures = "Capability:raise-failures";

    public static string For(string capability) => $"Capability:{capability}";
}
