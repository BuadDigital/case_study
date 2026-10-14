namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// The appraiser's progress as the study queue draws it: a ladder of milestones from his real work, so the bar
/// rises step by step instead of jumping from empty to full when his task completes (which now happens only at
/// the final issuance). Pure — the caller reads the facts.
/// </summary>
public static class AppraiserProgressRules
{
    public const int Started = 10;
    public const int MarketDone = 30;
    public const int CostDone = 50;
    public const int OpinionSaved = 65;
    /// <summary>Handed over to the specialist (the package is submitted). Any draft state implies it.</summary>
    public const int HandedOver = 75;
    public const int DraftSent = 85;
    public const int Approved = 92;
    public const int FinalIssued = 100;

    /// <summary>0–65: how far the valuation itself got.</summary>
    /// <param name="started">The approach settings were saved («بدء التقييم»).</param>
    /// <param name="marketAdopted">Adopted comparables of the market approach.</param>
    /// <param name="landAdopted">Adopted land comparables of the cost approach.</param>
    /// <param name="costSaved">The cost approach was saved.</param>
    /// <param name="opinionSaved">The reconciliation and final opinion were saved.</param>
    public static int Work(
        bool started,
        bool marketEnabled,
        int marketAdopted,
        bool costEnabled,
        int landAdopted,
        bool costSaved,
        bool opinionSaved)
    {
        var pct = 0;
        if (started)
        {
            pct = Started;
            var marketDone = !marketEnabled || marketAdopted >= 1;
            if (marketDone)
            {
                pct = MarketDone;
                var costDone = !costEnabled || (landAdopted >= 1 && costSaved);
                if (costDone) pct = CostDone;
            }
        }

        return opinionSaved ? Math.Max(pct, OpinionSaved) : pct;
    }

    /// <summary>The whole ladder: the work, then what the report cycle reached.</summary>
    /// <param name="draftStatus">none | preparing | sent | approved.</param>
    /// <param name="reportStage">draft | deposit_issued | final_issued.</param>
    public static int Overall(int work, string draftStatus, string reportStage)
    {
        if (reportStage == ReportIssuanceStages.FinalIssued) return FinalIssued;
        if (reportStage == ReportIssuanceStages.DepositIssued || draftStatus == ReportDraftStatuses.Approved)
            return Approved;
        if (draftStatus == ReportDraftStatuses.Sent) return DraftSent;
        if (draftStatus == ReportDraftStatuses.Preparing) return HandedOver;
        return work;
    }
}
