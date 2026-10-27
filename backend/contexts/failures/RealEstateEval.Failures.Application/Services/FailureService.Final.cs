using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>
/// «التعذر النهائي عن المعاملة» — the supervisor's final failure on a whole transaction, from the
/// property ⋮ menu or the approve button of an escalated failure (one dialog, one endpoint).
/// </summary>
public partial class FailureService
{
    /// <summary>The party task kinds whose assignees hear about a final failure.</summary>
    private static readonly WorkflowTaskKind[] FinalFailurePartyKinds =
    [
        WorkflowTaskKind.FieldInspection,
        WorkflowTaskKind.EngineeringSurvey,
        WorkflowTaskKind.PropertyAppraisal,
    ];

    /// <summary>
    /// «التعذر النهائي عن المعاملة» — the supervisor's final failure on every live deed of the
    /// deed's transaction, from the property ⋮ menu or «اعتماد التعذّر» on an escalated failure.
    /// </summary>
    /// <remarks>
    /// How it works: validates the request, looks up the anchor deed, then its transaction (all
    /// live deeds, the deed alone when it has none). Every deed is first paired with its open
    /// failure; then on each deed the open failure is finalized, or — when there is none — a
    /// failure is filed with the chosen problem type and finalized at once. One save, then each
    /// finalized deed gets the approve side effects (deed «موقوف», tasks stopped, timeline, audit
    /// with the notify choice). The case specialists of each work order are told; the parties
    /// holding tasks on the deeds only when <see cref="FinalFailureRequest.NotifyParties"/> is set —
    /// otherwise their tasks stop silently. Party tasks are stopped, not cancelled.
    ///
    /// Edge cases: a deed already final is skipped; when every deed was already final the call
    /// writes nothing and answers a <c>propertyId</c> error. A deed with no open failure and no
    /// problem type is refused before anything is written (the pairing pass runs first for that).
    /// Removed deeds are ignored. The active-failure lookup is untracked, so finalizing it changed
    /// nothing on save in the first draft — the tracked row is now loaded by id before the
    /// transition. Linked deeds of another work order keep their own PO number.
    /// </remarks>
    public async Task<(IReadOnlyList<FailureRecordDto>? Result, Dictionary<string, string>? Errors)> RecordFinalFailureAsync(
        FinalFailureRequest request,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        var errors = FailureRecordRules.ValidateFinalFailure(request);
        if (errors is not null) return (null, errors);

        var propertyId = FailureRules.ParsePropertyId(request.PropertyId);
        var anchor = (await _caseStudyLookup.ListPropertiesByIdsAsync([propertyId], cancellationToken))
            .FirstOrDefault();
        var targetErrors = FailureRecordRules.ValidateCreateTarget(anchor is null ? [] : [anchor]);
        if (targetErrors is not null) return (null, targetErrors);

        var deedIds = anchor!.TransactionPropertyIds.Count > 0
            ? anchor.TransactionPropertyIds
            : [anchor.Id];
        var deeds = (await _caseStudyLookup.ListPropertiesByIdsAsync(deedIds, cancellationToken))
            .Where(d => !d.IsRemoved)
            .ToList();

        // Pair every deed with its open failure first, so a missing problem type is refused
        // before any deed is touched.
        var plan = new List<(CaseStudyPropertySnapshotDto Deed, PropertyFailure? Open)>();
        foreach (var deed in deeds)
        {
            var po = FinalFailureDeedPo(deed, anchor, request);
            var open = await _failures.GetActiveForPropertyAsync(po, deed.Id, cancellationToken);
            // The active lookup is untracked; the transition needs the tracked row.
            plan.Add((deed, open is null ? null : await _failures.FindAsync(open.Id, cancellationToken)));
        }
        if (plan.Any(p => p.Open is null) && string.IsNullOrWhiteSpace(request.ProblemTypeId))
            return (null, new Dictionary<string, string> { ["problemTypeId"] = "اختر نوع المشكلة" });

        var now = _time.UtcNow();
        var finalized = new List<PropertyFailure>();
        foreach (var (deed, open) in plan)
        {
            var failure = open;
            if (failure is null)
            {
                failure = FailureRules.NewFailure(
                    FailureRecordRules.FinalFailureCreateRequest(
                        request,
                        FinalFailureDeedPo(deed, anchor, request),
                        deed),
                    FailureRecordRules.SupervisorRaiserRole,
                    deed.CaseSpecialistName?.Trim() ?? "",
                    now);
                await _failures.AddAsync(failure, cancellationToken);
            }
            if (failure.TryFinalize(request.Reason, now)) finalized.Add(failure);
        }
        if (finalized.Count == 0)
            return (null, new Dictionary<string, string> { ["propertyId"] = "المعاملة متعذّرة نهائياً من قبل" });
        await _failures.SaveChangesAsync(cancellationToken);

        foreach (var failure in finalized)
        {
            await SetPropertyDeedStatusAsync(failure, FailureRecordRules.DeedStatusSuspended, cancellationToken);
            await BlockPropertyTasksForApprovedFailureAsync(failure, cancellationToken);
            await RecordApprovedAsync(failure, request.Reason, cancellationToken);
            await AppendFailureAuditAsync(
                actorUserId,
                "failure.approved",
                failure,
                before: null,
                after: new
                {
                    status = failure.Status,
                    finalNote = failure.FinalNote,
                    notifyParties = request.NotifyParties,
                },
                cancellationToken);
        }

        foreach (var po in finalized.Select(f => f.PoNumber).Distinct(StringComparer.Ordinal))
        {
            await NotifyPoSpecialistsAsync(
                po,
                FailureRules.ApprovedNotification(finalized.First(f => f.PoNumber == po)),
                cancellationToken);
        }
        if (request.NotifyParties)
            await NotifyFinalFailurePartiesAsync(finalized, cancellationToken);

        return (await ToDtosAsync(finalized, cancellationToken), null);
    }

    /// <summary>The deed's own work order, falling back to the request's for the anchor deed.</summary>
    /// <remarks>
    /// How it works: the snapshot's PO number when it has one; otherwise the request's PO for the
    /// anchor deed and the anchor's PO for a sibling.
    ///
    /// Edge cases: the fallback covers a snapshot whose work order row could not be read — the
    /// failure is still filed under a PO, never under an empty one that no queue would list.
    /// </remarks>
    private static string FinalFailureDeedPo(
        CaseStudyPropertySnapshotDto deed,
        CaseStudyPropertySnapshotDto anchor,
        FinalFailureRequest request)
    {
        var po = deed.PoNumber.Trim();
        if (po.Length > 0) return po;
        return deed.Id == anchor.Id ? request.PoNumber.Trim() : anchor.PoNumber.Trim();
    }

    /// <summary>One notice per party per deed: the deed, its work order and the supervisor's reason.</summary>
    /// <remarks>
    /// How it works: per finalized deed, the assignees of its inspection, survey and appraisal
    /// tasks are resolved to user ids and sent <see cref="FailureRecordRules.FinalFailurePartyNotification"/>.
    ///
    /// Edge cases: the resolver skips completed and cancelled tasks but keeps blocked ones, so it
    /// runs after the tasks were stopped and still finds the parties. A deed with no party task
    /// sends nothing. The case specialists are told separately (they hold the parent task).
    /// </remarks>
    private async Task NotifyFinalFailurePartiesAsync(
        IReadOnlyList<PropertyFailure> finalized,
        CancellationToken cancellationToken)
    {
        foreach (var failure in finalized)
        {
            var recipients = await _recipients.ResolveAssigneeUserIdsForPropertyAsync(
                failure.PropertyId,
                FinalFailurePartyKinds,
                cancellationToken);
            if (recipients.Count == 0) continue;
            await _notifications.CreateForUsersAsync(
                recipients,
                FailureRecordRules.FinalFailurePartyNotification(failure),
                cancellationToken);
        }
    }
}
