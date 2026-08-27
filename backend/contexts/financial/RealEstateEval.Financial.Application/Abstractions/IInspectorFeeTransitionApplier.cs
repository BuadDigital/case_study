using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// Applies a billing-status transition to a tracked ledger (does not call SaveChanges).
/// Returns null on success, or an Arabic error message.
/// </summary>
public interface IInspectorFeeTransitionApplier
{
    Task<string?> ApplyAsync(
        InspectorFeeLedger ledger,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false);
}
