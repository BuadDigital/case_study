using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;
using static RealEstateEval.Financial.Application.Rules.PartyBillingRowMapper;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// The create half of the party billing use case: a ledger-backed statement from a selection,
/// a court-visit payment order, and the monthly vendor run that feeds the former.
/// </summary>
public partial class PartyBillingStatementService
{
    public async Task<CreatePartyBillingStatementResponseDto> CreateStatementAsync(
        CreatePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var taskIds = ParseTaskIds(request.WorkflowTaskIds);
        if (taskIds.Count == 0)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "اختر بنداً واحداً على الأقل لإنشاء كشف الفوترة.",
            };
        }

 // Court-visit open charges use charge.Id as the ready-line key (same column as workflow task id).
        var openCharges = await _db.ListOpenCourtVisitChargesByIdsAsync(taskIds, cancellationToken);
        var mixError = PartyBillingStatementRules.ValidateCourtVisitMix(openCharges.Count, taskIds.Count);
        if (mixError is not null)
            return new CreatePartyBillingStatementResponseDto { Error = mixError };

        if (openCharges.Count > 0)
        {
            return await CreateCourtVisitStatementAsync(
                taskIds,
                openCharges,
                request,
                actorUserId,
                cancellationToken);
        }

        var candidates = await _db.ListLedgersByTaskIdsAsync(taskIds, track: true, cancellationToken);

 // Unique IX on PartyBillingStatementLines.WorkflowTaskId — cannot re-bill a task.
        var alreadyLined = await _db.ListClaimedLineKeysAsync(taskIds, cancellationToken);

        var kinds = await _lookup.GetWorkflowTaskKindsAsync(taskIds, cancellationToken);
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            taskIds,
            candidates,
            alreadyLined,
            kinds);
        if (plan.Error is not null)
            return new CreatePartyBillingStatementResponseDto { Error = plan.Error };

        var statementKind = plan.StatementKind;
        var assigneeId = plan.AssigneeId;

        var now = _time.UtcNow();
        string reference;
        try
        {
            reference = await NextReferenceAsync(now, cancellationToken);
        }
        catch (Exception ex)
        {
 // Reference allocation reads a sequence and can surface storage-level detail.
 // Keep it in the log; the caller only learns that the attempt failed.
            _logger.LogError(
                ex,
                "Failed to allocate an engineering billing statement reference for assignee {AssigneeId}",
                assigneeId);
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "تعذر إنشاء كشف الفوترة. حاول مرة أخرى، وإذا تكرر الخطأ راجع الدعم الفني.",
            };
        }

        var statementId = Guid.NewGuid();
        var draft = PartyBillingDraftRules.BuildLedgerDraft(
            statementId,
            plan.Groups,
            reference,
            actorUserId,
            now);
        foreach (var transition in draft.Transitions)
            _db.AddTransition(transition);

        var deferredDtos = new List<PartyBillingReadyLineDto>();
        if (request.DeferUnselectedForAssignee)
        {
            var unselected = await _db.ListUnselectedAtFinanceLedgersAsync(
                assigneeId,
                taskIds,
                cancellationToken);

            var unselectedIds = unselected.Select(l => l.WorkflowTaskId).ToList();
            if (unselectedIds.Count > 0)
            {
 // Defer only same-kind leftovers for this assignee.
                var leftovers = PartyBillingDraftRules.SameKindLeftovers(
                    unselected,
                    await _lookup.GetWorkflowTaskKindsAsync(unselectedIds, cancellationToken),
                    statementKind);
                var labels = await LoadPropertyLabelsAsync(
                    PartyBillingStatementRules.PropertyIdsOf(leftovers),
                    cancellationToken);

                foreach (var ledger in leftovers)
                {
                    _db.AddTransition(PartyBillingStatementRules.Defer(
                        ledger,
                        PartyBillingStatementRules.NotInStatementDeferralReason(reference),
                        actorUserId,
                        now));
                    deferredDtos.Add(ToReadyDto(ledger, labels, statementKind));
                }
            }
        }

        _db.AddStatement(PartyBillingDraftRules.NewDraft(
            statementId,
            reference,
            assigneeId,
            PartyBillingPayeeType.FromTaskKind(statementKind),
            statementKind.ToDbValue(),
            draft.TotalNetSar,
            request.Notes,
            actorUserId,
            now,
            draft.Lines));

        await _db.SaveChangesAsync(cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return new CreatePartyBillingStatementResponseDto
        {
            Statement = dto,
            DeferredLines = deferredDtos,
        };
    }

    public async Task<CreateMonthPartyBillingStatementsResponseDto> CreateMonthVendorStatementsAsync(
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var ready = await ListReadyLinesAsync(cancellationToken: cancellationToken);
        var vendorReady = PartyBillingDraftRules.VendorReadyByAssignee(ready);

        if (vendorReady.Count == 0)
        {
            return new CreateMonthPartyBillingStatementsResponseDto
            {
                Error = "لا بنود مورّد جاهزة لإنشاء مسيرات.",
            };
        }

        var monthStart = PartyBillingStatementRules.MonthStart(_time.UtcNow());
        var created = new List<PartyBillingStatementDto>();
        var linesIncluded = 0;

 // One query for open pipelines this month instead of AnyAsync per vendor.
        var vendorIds = vendorReady.Select(g => g.Key).ToList();
        var openThisMonth = (await _db.ListVendorsWithOpenStatementsAsync(
                vendorIds, monthStart, cancellationToken))
            .ToHashSet(StringComparer.Ordinal);

        foreach (var group in vendorReady)
        {
            if (openThisMonth.Contains(group.Key)) continue;

            var result = await CreateStatementAsync(
                new CreatePartyBillingStatementRequest
                {
                    WorkflowTaskIds = group.Select(l => l.WorkflowTaskId).ToList(),
                    DeferUnselectedForAssignee = false,
                    Notes = PartyBillingDraftRules.MonthRunNotes(monthStart),
                },
                actorUserId,
                cancellationToken);

            if (result.Error is not null || result.Statement is null)
            {
                _logger.LogWarning(
                    "Month vendor statement skipped for assignee {AssigneeId}: {Error}",
                    group.Key,
                    result.Error);
                continue;
            }

            created.Add(result.Statement);
            linesIncluded += result.Statement.Lines.Count;
        }

        return PartyBillingDraftRules.MonthRunResponse(created, linesIncluded);
    }

    private async Task<CreatePartyBillingStatementResponseDto> CreateCourtVisitStatementAsync(
        IReadOnlyList<Guid> chargeIds,
        IReadOnlyList<CourtVisitFeeCharge> charges,
        CreatePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken)
    {
        var alreadyLined = await _db.ListClaimedLineKeysAsync(chargeIds, cancellationToken);
        var (selectionError, assigneeId) =
            PartyBillingStatementRules.ValidateCourtVisitSelection(charges, alreadyLined);
        if (selectionError is not null)
            return new CreatePartyBillingStatementResponseDto { Error = selectionError };

        var now = _time.UtcNow();
        string reference;
        try
        {
            reference = await NextReferenceAsync(now, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to allocate billing statement reference for court-visit assignee {AssigneeId}",
                assigneeId);
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "تعذر إنشاء كشف الفوترة. حاول مرة أخرى، وإذا تكرر الخطأ راجع الدعم الفني.",
            };
        }

        var statementId = Guid.NewGuid();
 // Statement line unique key = charge id (not workflow task id).
        var statementLines = PartyBillingDraftRules.CourtVisitLines(statementId, charges);

        foreach (var charge in charges)
            charge.UpdatedAtUtc = now;

        _db.AddStatement(PartyBillingDraftRules.NewDraft(
            statementId,
            reference,
            assigneeId,
            PartyBillingPayeeType.Individual,
            CourtVisitTaskKind,
            charges.Sum(c => c.AmountSar),
            request.Notes,
            actorUserId,
            now,
            statementLines));

        await _db.SaveChangesAsync(cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return new CreatePartyBillingStatementResponseDto
        {
            Statement = dto,
            DeferredLines = [],
        };
    }
}
