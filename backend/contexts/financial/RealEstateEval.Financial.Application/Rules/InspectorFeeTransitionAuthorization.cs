using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Role / assignee gates for inspector-fee billing actions (not status-machine edges).
/// </summary>
/// <remarks>
/// The engineering office has no action of its own on a discount any more (approve / dispute were
/// retired); the supervisor's decision on a proposed discount goes through
/// <c>InspectorFeeService.ResolveDiscountProposalAsync</c>, not through a transition.
/// </remarks>
public static class InspectorFeeTransitionAuthorization
{
    public static bool CanPerformAction(
        string action,
        InspectorFeeLedger ledger,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer)
    {
        return action switch
        {
            InspectorFeeActions.SubmitToSupervisor
                or InspectorFeeActions.CreateDisbursementRequest =>
                !string.IsNullOrWhiteSpace(actorAssigneeId)
                && string.Equals(ledger.AssigneeId?.Trim(), actorAssigneeId.Trim(), StringComparison.Ordinal),

            InspectorFeeActions.ApproveToFinance
                or InspectorFeeActions.ResendToFinance
                or InspectorFeeActions.ReturnToOffice
                or InspectorFeeActions.Suspend
                or InspectorFeeActions.LiftSuspension => isOperationsManager,

            InspectorFeeActions.Disburse
                or InspectorFeeActions.ReturnToSupervisor
                or InspectorFeeActions.InquiryToOffice => isFinancialOfficer,

            _ => false,
        };
    }
}
