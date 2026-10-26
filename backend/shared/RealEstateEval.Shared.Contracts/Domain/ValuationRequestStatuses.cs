namespace RealEstateEval.Domain;

/// <summary>
/// Wire/database strings for <see cref="ValuationRequestStatus"/>, plus the conversions between
/// the two. <c>fail</c> (not <c>failed</c>) is the stored value; keep stable for the
/// open-per-property filter.
/// </summary>
public static class ValuationRequestStatuses
{
    public const string Progress = "progress";
    public const string Done = "done";
    public const string Failed = "fail";
    // Phase 5 (decision 2026-10-19): a deed's request folded into the holder deed's request.
    public const string Merged = "merged";

    public static string ToDbValue(this ValuationRequestStatus status) => status switch
    {
        ValuationRequestStatus.Done => Done,
        ValuationRequestStatus.Failed => Failed,
        ValuationRequestStatus.Merged => Merged,
        _ => Progress,
    };

    public static bool TryParse(string? value, out ValuationRequestStatus status)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case Progress: status = ValuationRequestStatus.Progress; return true;
            case Done: status = ValuationRequestStatus.Done; return true;
            case Failed: status = ValuationRequestStatus.Failed; return true;
            case Merged: status = ValuationRequestStatus.Merged; return true;
            default: status = ValuationRequestStatus.Progress; return false;
        }
    }

 /// <summary>Lenient read path; unrecognised legacy values read back as in-progress.</summary>
    public static ValuationRequestStatus Parse(string? value) =>
        TryParse(value, out var status) ? status : ValuationRequestStatus.Progress;
}
