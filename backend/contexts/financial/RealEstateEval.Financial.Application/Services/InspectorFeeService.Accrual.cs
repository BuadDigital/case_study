using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Application.Rules;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Engineering-survey fee accrual on the specialist's acceptance (with or without a discount
/// proposal). The proposal follow-ups live in <c>InspectorFeeService.DiscountProposals.cs</c>.
/// </summary>
public partial class InspectorFeeService
{
    /// <summary>
    /// Accrues the engineering-office fee when the specialist accepts the survey outputs — one
    /// priced line per deed of the task — with or without the specialist's discount proposal.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b></para>
    /// <list type="number">
    /// <item>Checks the task is a completed survey whose outputs were submitted.</item>
    /// <item>If every deed already has an accrued line (re-acceptance): returns the row as is — or,
    /// when this acceptance carries a proposal, hands over to <c>ProposeOnAccruedLinesAsync</c>.</item>
    /// <item>Otherwise prices each deed from the pricing table (area from the property, or from the
    /// office's on-site area when the property has none) and creates or refreshes its line. With a
    /// proposal the lines land in <c>sup-review</c>, without one in <c>at-finance</c>.</item>
    /// <item>With a proposal: validates it against the fee just priced, adds the pending
    /// <see cref="DiscountFlag"/>, saves, then notifies the office and the supervisors.</item>
    /// </list>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>Idempotent re-acceptance: a second accept never creates a second fee. It used to drop a
    /// proposal sent with it silently; the proposal is now routed to the unbilled lines.</item>
    /// <item>A proposal above the priced fee is refused before <c>SaveChanges</c>, so nothing is
    /// accrued and the specialist can accept again with a valid amount.</item>
    /// <item>Notifications go out only after the save, so nobody is told about a proposal that was
    /// rolled back.</item>
    /// </list>
    /// </remarks>
    public async Task<(InspectorFeeRowDto? Row, string? Error)> AccrueEngineeringSurveyFeeAsync(
        Guid workflowTaskId,
        string actorUserId,
        CancellationToken cancellationToken = default,
        EngineeringSurveyDiscountProposalInput? proposal = null)
    {
        // Two outcomes of the specialist's acceptance (ruling of 2026-10-26):
        //   no proposal   → the fee is priced from the table and goes straight to finance;
        //   with proposal → the same fee waits in sup-review at full amount, and a pending
        //                   DiscountFlag records the proposed amount for the supervisor to decide.
        var hasProposal = DiscountProposalRules.HasProposal(proposal?.ProposedDiscountSar);
        var snapshot = await _lookup.GetWorkflowTaskAsync(workflowTaskId, cancellationToken);
        if (snapshot is null)
            return (null, InspectorFeeAccrualRules.TaskNotFoundError);
        var task = snapshot.ToWorkflowTask();

        var submissions = await _lookup.ListPartyTaskSubmissionsByTaskIdsAsync(
            [workflowTaskId], cancellationToken);
        var submission = submissions.FirstOrDefault()?.ToSubmission();
        var accrualError = InspectorFeeAccrualRules.ValidateEngineeringSurveyAccrual(task, submission);
        if (accrualError is not null)
            return (null, accrualError);

        var deeds = await _resolver.ResolveDeedTargetsAsync(task, cancellationToken);
        var existingForTask =
            (await _ledgers.ListByWorkflowTaskAsync(workflowTaskId, cancellationToken)).ToList();

 // Idempotent: every target deed already accrued — do not create a second fee on re-accept.
 // A proposal sent with a re-acceptance still reaches the supervisor, on the lines not yet billed.
        if (InspectorFeeAccrualRules.AllDeedsAccrued(deeds, existingForTask))
        {
            if (!hasProposal)
                return (await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken), null);
            return await ProposeOnAccruedLinesAsync(
                workflowTaskId, existingForTask, proposal!, actorUserId, cancellationToken);
        }

        var partyType = existingForTask.FirstOrDefault()?.InspectorType
            ?? await _resolver.ResolvePartyTypeAsync(task, cancellationToken);
        var now = _time.UtcNow();
        InspectorFeeLedger? lastLedger = null;
        var ordinal = 0;
        foreach (var deed in deeds)
        {
            ordinal++;
            var areaM2 = await _resolver.ResolvePropertyAreaM2Async(
                task, cancellationToken, deed.PropertyId);
 // Offices enter total area on the survey form; PO Area is often still empty.
 // Prefer that submitted area for tier pricing, and backfill the property row when empty.
            if (areaM2 is not > 0m)
            {
                areaM2 = InspectorFeeAccrualRules.TryParseSurveyOnSiteAreaM2(submission!.PayloadJson);
                if (areaM2 is > 0m && deed.PropertyId is Guid propertyId)
                    await BackfillPropertyAreaIfEmptyAsync(
                        propertyId, areaM2.Value, cancellationToken);
            }

            if (areaM2 is not > 0m)
                return (null, PricingErrors.PropertyAreaMissing);

            var resolvedFee = await _pricing.ResolveDefaultFeeAsync(
                task.Kind,
                partyType,
                areaM2,
                task.AssigneeId,
                cancellationToken);

            if (!resolvedFee.IsResolved)
                return (null, PricingErrors.FeeUnresolved);

            var agreedFee = resolvedFee.FeeSar!.Value;
            var identity = await _resolver.ResolveLedgerIdentityAsync(
                task, cancellationToken, deed.DeedId);
            var ledger = existingForTask.FirstOrDefault(l => l.DeedId == identity.DeedId)
                ?? await _ledgers.FindByIdentityAsync(
                    identity.TransactionId,
                    identity.DeedId,
                    identity.UserId,
                    cancellationToken);

            if (ledger is not null && InspectorFeeAccrualRules.IsAccrued(ledger))
            {
                lastLedger = ledger;
                continue;
            }

            if (ledger is null)
            {
                ledger = InspectorFeeAccrualRules.NewAccruedLedger(
                    task,
                    identity,
                    deed,
                    ordinal,
                    partyType,
                    agreedFee,
                    resolvedFee.PricingTableId,
                    now,
                    hasProposal);
                _ledgers.AddLedger(ledger);
                existingForTask.Add(ledger);
            }
            else
            {
                InspectorFeeAccrualRules.RefreshAccruedLedger(
                    ledger,
                    task,
                    identity,
                    deed,
                    ordinal,
                    partyType,
                    agreedFee,
                    resolvedFee.PricingTableId,
                    now,
                    hasProposal);
            }

            _ledgers.AddTransition(
                InspectorFeeAccrualRules.AccrualTransition(ledger, actorUserId, now));
            lastLedger = ledger;
        }

        if (lastLedger is null)
            return (null, PricingErrors.FeeUnresolved);

        // The proposal is checked against the fee just priced (the sum of the task's lines now in
        // sup-review); an invalid one returns before SaveChanges, so nothing is accrued either.
        DiscountFlag? flag = null;
        if (hasProposal)
        {
            var awaiting = DiscountProposalRules.AwaitingLines(existingForTask);
            var proposalError = DiscountProposalRules.ValidateProposal(
                proposal!.ProposedDiscountSar,
                proposal.DiscountReason,
                awaiting.Sum(l => l.AgreedFeeSar));
            if (proposalError is not null)
                return (null, proposalError);

            flag = DiscountProposalRules.NewFlag(
                lastLedger,
                proposal.ProposedDiscountSar!.Value,
                proposal.DiscountReason!,
                actorUserId,
                proposal.ProposedByName,
                now);
            _ledgers.AddDiscountFlag(flag);
        }

        await _ledgers.SaveChangesAsync(cancellationToken);
        // Notify only after the save: the office hears «under review», the supervisors the prompt.
        if (flag is not null)
            await NotifyDiscountProposedAsync(flag, cancellationToken);
        return (await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken), null);
    }
}
