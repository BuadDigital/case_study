namespace RealEstateEval.Domain;

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
    public string PropertyId { get; private set; } = "";
    public string Area { get; private set; } = "";
    public string PropertyType { get; private set; } = "";
    public string Appraiser { get; private set; } = "";
    public ValuationRequestStatus Status { get; private set; } = ValuationRequestStatus.Progress;
    public string RequestDate { get; private set; } = "";
    public DateTime UpdatedAtUtc { get; private set; }

    /// <summary>
    /// Anything other than <see cref="ValuationRequestStatus.Done"/> counts as open and holds the
    /// property, including an impediment. The partial unique index on ValuationRequests encodes
    /// the same rule.
    /// </summary>
    public bool IsOpen => Status != ValuationRequestStatus.Done;

    public static ValuationRequest Create(
        Guid id,
        string displayId,
        string propertyId,
        string area,
        string propertyType,
        string appraiser,
        string requestDate,
        DateTime nowUtc,
        ValuationRequestStatus status = ValuationRequestStatus.Progress) => new()
        {
            Id = id,
            DisplayId = displayId.Trim(),
            PropertyId = propertyId.Trim(),
            Area = area.Trim(),
            PropertyType = propertyType.Trim(),
            Appraiser = appraiser.Trim(),
            Status = status,
            RequestDate = requestDate.Trim(),
            UpdatedAtUtc = nowUtc,
        };

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
    /// An impediment (تعذر) keeps the request open — the property stays held until the
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

public enum ValuationRequestStatus
{
    Progress = 0,
    Done = 1,
    Failed = 2,
}

/// <summary>Outcome of a <see cref="ValuationRequest"/> transition attempt.</summary>
public enum ValuationRequestTransition
{
    Applied = 0,
    AlreadySubmitted = 1,
    AlreadyImpeded = 2,
}
