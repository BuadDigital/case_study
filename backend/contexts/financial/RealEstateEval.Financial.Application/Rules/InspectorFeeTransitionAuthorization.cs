using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Role / assignee gates for inspector-fee billing actions (not status-machine edges).
/// </summary>
public static class InspectorFeeTransitionAuthorization
{
    public static bool CanPerformAction(
        string action,
        InspectorFeeLedger ledger,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer)
    {
 // Employees never enter the office-approval / dispute loop.
        if (InspectorFeeRules.IsEmployee(ledger.InspectorType)
            && action is InspectorFeeActions.OfficeApproveDiscount
                or InspectorFeeActions.OfficeDispute
                or InspectorFeeActions.ResolveDispute)
        {
            return false;
        }

        return action switch
        {
            InspectorFeeActions.SubmitToSupervisor
                or InspectorFeeActions.CreateDisbursementRequest
                or InspectorFeeActions.OfficeApproveDiscount
                or InspectorFeeActions.OfficeDispute =>
                !string.IsNullOrWhiteSpace(actorAssigneeId)
                && string.Equals(ledger.AssigneeId?.Trim(), actorAssigneeId.Trim(), StringComparison.Ordinal),

            InspectorFeeActions.ApproveToFinance
                or InspectorFeeActions.ResendToFinance
                or InspectorFeeActions.ReturnToOffice
                or InspectorFeeActions.ResolveDispute
                or InspectorFeeActions.Suspend
                or InspectorFeeActions.LiftSuspension => isOperationsManager,

            InspectorFeeActions.Disburse
                or InspectorFeeActions.ReturnToSupervisor
                or InspectorFeeActions.InquiryToOffice => isFinancialOfficer,

            _ => false,
        };
    }
}
