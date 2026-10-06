using RealEstateEval.Application;
using RealEstateEval.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed partial class EvaluatorRecallsService
{
    public async Task<(EvaluatorRecallDto? Result, Dictionary<string, string>? Errors)> DecideAsync(
        string taskId,
        DecideEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default,
        string? actorUserId = null)
    {
        var decision = request.Decision?.Trim().ToLowerInvariant();
        if (decision is not (EvaluatorRecallDecisions.Approve or EvaluatorRecallDecisions.Reject))
        {
            return (null, new Dictionary<string, string>
            {
                ["decision"] = "القرار مطلوب: اعتماد أو رفض",
            });
        }

        if (!TryParseId(taskId, out var id)) return (null, null);
        var row = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == id, cancellationToken);
        if (row is null) return (null, null);
        // Decided already: the answer stays what it was (a double click or a retried request).
        if (row.Status != EvaluatorRecallStatus.Pending) return (ToDto(row), null);

        return decision == EvaluatorRecallDecisions.Approve
            ? await ApproveCoreAsync(row, actorUserId, cancellationToken)
            : (await RejectCoreAsync(row, request.Note, cancellationToken), null);
    }

    /// <summary>
    /// Two services, two databases, no shared transaction — so the order is the safety: the
    /// appraiser's package is reopened FIRST (idempotent on the owner side), and only then is the
    /// approval recorded. If the second step fails the recall stays pending and the whole
    /// decision can be sent again.
    /// </summary>
    private async Task<(EvaluatorRecallDto? Result, Dictionary<string, string>? Errors)> ApproveCoreAsync(
        EvaluatorRecallRecord row,
        string? actorUserId,
        CancellationToken cancellationToken)
    {
        var deposit = await FindDepositAsync(row.PropertyId, cancellationToken);
        if (deposit is not null)
        {
            // A deposited report (code recorded) goes back as a new version: the one reopen operation also reopens
            // the appraiser's package and task. Before the code the appraiser takes his own approval back.
            if (!deposit.Value.CodeRecorded || _issuance is null)
                return (null, new Dictionary<string, string> { ["_"] = DepositedRecallMessageAr });

            var reason = string.IsNullOrWhiteSpace(row.Reason) ? DepositedRecallDefaultReasonAr : row.Reason.Trim();
            var (_, reopenErrors) = await _issuance.ReopenAfterDepositAsync(
                deposit.Value.ValuationRequestId,
                new ReopenReportIssuanceRequest { Reason = reason },
                actorUserId,
                cancellationToken);
            if (reopenErrors is not null)
                return (null, reopenErrors);
        }
        else
        {
            try
            {
                var (_, error) = await _caseStudy.ReopenAppraisalForRecallAsync(
                    row.TaskId, row.Reason, cancellationToken);
                if (error is not null)
                    return (null, new Dictionary<string, string> { ["_"] = error });
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException
                && !cancellationToken.IsCancellationRequested)
            {
                return (null, new Dictionary<string, string> { [UpstreamErrorKey] = ReopenUnavailableMessageAr });
            }
        }

        row.Status = EvaluatorRecallStatus.Approved;
        row.ResolvedAtUtc = _time.UtcNow();

        // The reopen carries its own «إعادة للتصحيح» notice from Case Study; this one tells the
        // appraiser the recall he asked for was granted, with the reason he gave.
        await NotifyAsync(
            row.PropertyId,
            ValuationNoticeAudiences.Appraiser,
            title: "قُبل استرجاع التقرير",
            summary: "وافق الأخصائي على استرجاع تقرير التقييم — التقرير عاد إليك للتعديل",
            note: row.Reason,
            href: $"/property-appraisal/{Uri.EscapeDataString(row.TaskId.ToString("D"))}",
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        return (ToDto(row), null);
    }

    private async Task<EvaluatorRecallDto> RejectCoreAsync(
        EvaluatorRecallRecord row,
        string? note,
        CancellationToken cancellationToken)
    {
        row.Status = EvaluatorRecallStatus.Rejected;
        row.SpecialistNote = note?.Trim() ?? "";
        row.ResolvedAtUtc = _time.UtcNow();

        await NotifyAsync(
            row.PropertyId,
            ValuationNoticeAudiences.Appraiser,
            title: "رُفض استرجاع التقرير",
            summary: "رفض الأخصائي طلب استرجاع تقرير التقييم",
            note: row.SpecialistNote,
            href: $"/property-appraisal/{Uri.EscapeDataString(row.TaskId.ToString("D"))}",
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        return ToDto(row);
    }

    /// <summary>
    /// The property's current (not superseded) deposit copy, if any: it freezes the report, and once its code is
    /// recorded reopening it is a new version.
    /// </summary>
    private async Task<(Guid ValuationRequestId, bool CodeRecorded)?> FindDepositAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var row = await _db.ValuationReportIssuances.AsNoTracking()
            .Where(issuance => issuance.SupersededAtUtc == null
                && _db.ValuationRequests.Any(
                    request => request.Id == issuance.ValuationRequestId
                        && request.PropertyId == propertyId))
            .Select(issuance => new
            {
                issuance.ValuationRequestId,
                CodeRecorded = (issuance.DepositCode != null && issuance.DepositCode != "")
                    || issuance.FinalIssuedAtUtc != null,
            })
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? null : (row.ValuationRequestId, row.CodeRecorded);
    }

    private const string DepositedRecallDefaultReasonAr = "طلب المقيّم استرجاع التقرير بعد الإيداع";
}
