namespace RealEstateEval.Domain;

public enum ValuationRequestStatus
{
    Progress = 0,
    Done = 1,
    Failed = 2,
    /// <summary>
    /// Phase 5 (decision 2026-10-19): the deed was merged into another deed's transaction — its
    /// valuation continues on the holder deed's request (<c>MergedIntoRequestId</c>). Not open.
    /// </summary>
    Merged = 3,
}
