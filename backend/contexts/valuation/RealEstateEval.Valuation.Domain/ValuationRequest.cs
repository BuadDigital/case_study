using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// A valuation request dispatched for one property. Only one may be open per property, so the
/// status transitions are the aggregate's whole reason to exist and are enforced here rather
/// than in the service.
/// </summary>
public class ValuationRequest
{
 /// <summary>For EF materialization and <see cref="Create"/>.</summary>
    private ValuationRequest()
    {
    }

    public Guid Id { get; private set; }
    public string DisplayId { get; private set; } = "";
    public Guid PropertyId { get; private set; }
    public string Area { get; private set; } = "";
    public string PropertyType { get; private set; } = "";
    public string Appraiser { get; private set; } = "";
    public ValuationRequestStatus Status { get; private set; } = ValuationRequestStatus.Progress;
    public DateOnly RequestDate { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    /// <summary>
    /// The report number PRV-{YY}-{seq}, derived from the transaction's official reference the
    /// moment the appraiser approves the report (decision 2026-10-19). Null until then; never
    /// changes afterwards (a reopened report keeps the number and takes a version suffix).
    /// </summary>
    public string? ReportNumber { get; private set; }

    /// <summary>Fixes the PRV-… report number on the request, once.</summary>
    /// <remarks>
    /// How it works: trims the given number; stores it and stamps UpdatedAtUtc only when it is not
    /// blank and the request has no number yet.
    /// Edge cases: a second call (reopen, retry, a different number) is a silent no-op, so the printed
    /// number never changes (decision 2026-10-19); a blank number is ignored.
    /// </remarks>
    public void AssignReportNumber(string reportNumber, DateTime nowUtc)
    {
        var trimmed = (reportNumber ?? "").Trim();
        if (trimmed.Length == 0 || !string.IsNullOrWhiteSpace(ReportNumber)) return;
        ReportNumber = trimmed;
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>
    /// Phase 5 (decision 2026-10-19): the deed was merged into another deed's transaction and this
    /// request folded into the holder deed's one. Null unless <see cref="Status"/> is Merged.
    /// </summary>
    public Guid? MergedIntoRequestId { get; private set; }

    /// <summary>Folds an open request into the holder's; a closed request is left alone.</summary>
    /// <remarks>
    /// How it works: returns false for a done request, and for one already merged into the same
    /// <paramref name="holderRequestId"/>; otherwise sets status merged, MergedIntoRequestId and
    /// UpdatedAtUtc and returns true (the caller counts and saves only the true ones).
    /// Edge cases: idempotent (phase 5). The target may be null — a merge before distribution
    /// (2026-10-21) folds before the holder has a request; a later fold with the holder's new request
    /// re-points the row, because only the same target counts as «already merged».
    /// </remarks>
    public bool MarkMerged(Guid? holderRequestId, DateTime nowUtc)
    {
        if (Status == ValuationRequestStatus.Done) return false;
        if (Status == ValuationRequestStatus.Merged && MergedIntoRequestId == holderRequestId) return false;
        Status = ValuationRequestStatus.Merged;
        MergedIntoRequestId = holderRequestId;
        UpdatedAtUtc = nowUtc;
        return true;
    }

    /// <summary>The deed left the transaction: its request is its own again.</summary>
    /// <remarks>
    /// How it works: only a merged request changes — status back to progress, MergedIntoRequestId
    /// cleared, UpdatedAtUtc stamped, returns true; any other status returns false (idempotent).
    /// </remarks>
    public bool Unmerge(DateTime nowUtc)
    {
        if (Status != ValuationRequestStatus.Merged) return false;
        Status = ValuationRequestStatus.Progress;
        MergedIntoRequestId = null;
        UpdatedAtUtc = nowUtc;
        return true;
    }

 /// <summary>
 /// Anything other than <see cref="ValuationRequestStatus.Done"/> or <see cref="ValuationRequestStatus.Merged"/>
 /// counts as open and holds the property, including an impediment. The partial unique index on
 /// ValuationRequests encodes the same rule.
 /// </summary>
    public bool IsOpen => Status is not (ValuationRequestStatus.Done or ValuationRequestStatus.Merged);

    public static ValuationRequest Create(
        Guid id,
        string displayId,
        Guid propertyId,
        string area,
        string propertyType,
        string appraiser,
        string requestDate,
        DateTime nowUtc,
        ValuationRequestStatus status = ValuationRequestStatus.Progress) => new()
        {
            Id = id,
            DisplayId = displayId.Trim(),
            PropertyId = propertyId,
            Area = area.Trim(),
            PropertyType = propertyType.Trim(),
            Appraiser = appraiser.Trim(),
            Status = status,
            RequestDate = ParseRequestDate(requestDate, nowUtc),
            UpdatedAtUtc = nowUtc,
        };

 /// <summary>
 /// The wire carries the request date as ISO text; anything unparsable is taken as "today" so a
 /// request is never stored without a date to sort and number by.
 /// </summary>
    public static DateOnly ParseRequestDate(string? text, DateTime nowUtc) =>
        DateOnly.TryParseExact(text?.Trim(), "yyyy-MM-dd", out var parsed)
            ? parsed
            : RiyadhClock.Today(nowUtc);

 /// <summary>The appraiser delivered the report — the request closes and releases the property.</summary>
    public ValuationRequestTransition SubmitReport(DateTime nowUtc)
    {
        if (Status == ValuationRequestStatus.Done)
            return ValuationRequestTransition.AlreadySubmitted;

        Status = ValuationRequestStatus.Done;
        UpdatedAtUtc = nowUtc;
        return ValuationRequestTransition.Applied;
    }

 /// <summary>
 /// Q-9 supplement (R2): reopen valuation cycle after deposit — inverse of <see cref="SubmitReport"/>;
 /// the request reopens and holds the property again until a newer deposit copy.
 /// </summary>
    public void ReopenReport(DateTime nowUtc)
    {
        Status = ValuationRequestStatus.Progress;
        UpdatedAtUtc = nowUtc;
    }

 /// <summary>
 /// An impediment (unable/blocked) keeps the request open — the property stays held until the
 /// impediment is resolved and a report is submitted.
 /// </summary>
    public ValuationRequestTransition RecordImpediment(DateTime nowUtc)
    {
        if (Status == ValuationRequestStatus.Done)
            return ValuationRequestTransition.AlreadySubmitted;
        if (Status == ValuationRequestStatus.Failed)
            return ValuationRequestTransition.AlreadyImpeded;

        Status = ValuationRequestStatus.Failed;
        UpdatedAtUtc = nowUtc;
        return ValuationRequestTransition.Applied;
    }
}

// ValuationRequestStatus stays in the global Domain (shared by Case Study dispatch, Reporting, EF converters).

/// <summary>Outcome of a <see cref="ValuationRequest"/> transition attempt.</summary>
public enum ValuationRequestTransition
{
    Applied = 0,
    AlreadySubmitted = 1,
    AlreadyImpeded = 2,
}
