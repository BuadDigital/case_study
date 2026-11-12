using RealEstateEval.Application;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>
/// «الرجوع من التعذّر النهائي» (Omar 2026-11-12) — the liquidation centre says the transaction came
/// back from its failure on Enfaz, so coordination takes the final failure back and the work goes on.
/// </summary>
public partial class FailureService
{
    /// <summary>
    /// Takes the final failure back on every live deed of the deed's transaction: the failures close,
    /// the deeds turn «فعال», the stopped tasks reopen and everyone concerned is told.
    /// </summary>
    /// <remarks>
    /// How it works: 1) the coordination sub-role and the request are checked; 2) the anchor deed
    /// gives its transaction (all live deeds, the deed alone when it has none); 3) every final
    /// failure of those deeds is closed with the reason (<see cref="PropertyFailure.TryRevertFinal"/>),
    /// one save; 4) per closed failure: deed «فعال», tasks reopened on the case-study side, a timeline
    /// step and an audit row; 5) coordination, the section supervisor and the parties holding tasks
    /// on the deeds are notified.
    ///
    /// Edge cases: a transaction with no final failure writes nothing and answers a
    /// <c>propertyId</c> error — so does a repeated request. Removed deeds are ignored. A deed that
    /// still carries another open hold (an eviction record, a supervisor's «تعليق») keeps its
    /// case-study task stopped; only the parties' tasks reopen there. The work order's due date is
    /// not touched — the time lost stays visible. The parties are told even when the final failure
    /// stopped them silently: their task is open again either way.
    /// </remarks>
    public async Task<(IReadOnlyList<FailureRecordDto>? Result, Dictionary<string, string>? Errors)> RevertFinalFailureAsync(
        RevertFinalFailureRequest request,
        string? actorUserId,
        StaffActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanRevertFinalFailure(actor))
            return (null, new Dictionary<string, string> { ["_"] = FailureRecordRules.RevertFinalFailureRoleDeniedAr });

        var errors = FailureRecordRules.ValidateRevertFinalFailure(request);
        if (errors is not null) return (null, errors);

        var propertyId = FailureRules.ParsePropertyId(request.PropertyId);
        var anchor = (await _caseStudyLookup.ListPropertiesByIdsAsync([propertyId], cancellationToken))
            .FirstOrDefault();
        if (anchor is null)
            return (null, new Dictionary<string, string> { ["propertyId"] = "العقار غير موجود" });

        var deedIds = anchor.TransactionPropertyIds.Count > 0
            ? anchor.TransactionPropertyIds
            : [anchor.Id];
        var liveDeedIds = (await _caseStudyLookup.ListPropertiesByIdsAsync(deedIds, cancellationToken))
            .Where(d => !d.IsRemoved)
            .Select(d => d.Id)
            .ToList();

        var now = _time.UtcNow();
        var reverted = (await _failures.FindApprovedForPropertiesAsync(liveDeedIds, cancellationToken))
            .Where(f => f.TryRevertFinal(request.Reason, now))
            .ToList();
        if (reverted.Count == 0)
            return (null, new Dictionary<string, string> { ["propertyId"] = FailureRecordRules.NotFinalFailureAr });
        await _failures.SaveChangesAsync(cancellationToken);

        foreach (var failure in reverted)
        {
            await SetPropertyDeedStatusAsync(failure, FailureRecordRules.DeedStatusActive, cancellationToken);
            // Anything still unresolved on the deed is another hold — it keeps the case-study task stopped.
            var holdRemains = await _failures.HasUnresolvedAsync(
                failure.PoNumber, failure.PropertyId, cancellationToken);
            await _caseStudy.ReopenPropertyTasksAfterFailureAsync(
                FailureRules.ReopenTasksRequest(failure, holdRemains),
                cancellationToken);
            await RecordStageAsync(
                failure,
                "final-reverted",
                FailureRules.FinalRevertedTitleAr,
                failure.ResolutionReason,
                PropertyTimelineTones.Done,
                cancellationToken);
            await AppendFailureAuditAsync(
                actorUserId,
                "failure.final-reverted",
                failure,
                before: new { status = PropertyFailureStatus.Approved, finalNote = failure.FinalNote },
                after: new
                {
                    status = failure.Status,
                    reason = failure.ResolutionReason,
                    poNumber = failure.PoNumber,
                },
                cancellationToken);
        }

        await NotifyFinalRevertedAsync(reverted, cancellationToken);

        return (await ToDtosAsync(reverted, cancellationToken), null);
    }

    /// <summary>Who hears that a final failure was taken back.</summary>
    /// <remarks>
    /// How it works: one notice per work order to the coordination sub-role and the section
    /// supervisors (who record final failures), then one per deed to the assignees of its
    /// inspection, survey and appraisal tasks.
    ///
    /// Edge cases: the party resolver skips completed and cancelled tasks, and it runs after the
    /// tasks reopened; a deed with no party task sends nothing; nobody holding a role is skipped.
    /// </remarks>
    private async Task NotifyFinalRevertedAsync(
        IReadOnlyList<PropertyFailure> reverted,
        CancellationToken cancellationToken)
    {
        var staff = (await _recipients.ResolveCaseSpecialistUserIdsAsync(
                CaseSpecialistAudience.Operations,
                cancellationToken))
            .Concat(await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
                StaffRoleIds.SectionSupervisor,
                cancellationToken))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (staff.Count > 0)
        {
            foreach (var po in reverted.Select(f => f.PoNumber).Distinct(StringComparer.Ordinal))
            {
                await _notifications.CreateForUsersAsync(
                    staff,
                    FailureRecordRules.FinalRevertedNotification(reverted.First(f => f.PoNumber == po)),
                    cancellationToken);
            }
        }

        foreach (var failure in reverted)
        {
            var parties = await _recipients.ResolveAssigneeUserIdsForPropertyAsync(
                failure.PropertyId,
                FinalFailurePartyKinds,
                cancellationToken);
            if (parties.Count == 0) continue;
            await _notifications.CreateForUsersAsync(
                parties,
                FailureRecordRules.FinalRevertedPartyNotification(failure),
                cancellationToken);
        }
    }
}
