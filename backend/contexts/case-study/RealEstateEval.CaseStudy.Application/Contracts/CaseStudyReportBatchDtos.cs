namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// One case-study parent with its party children — the batch shape behind
/// <c>GET /api/case-study-reports/batch</c>. A parent the actor may not read (or that does not
/// exist) is simply absent from <see cref="CaseStudyReportBatchDto.ByParentTaskId"/>; a child the
/// actor may not read is absent from <see cref="PartyContributionsByChildTaskId"/>. Same rule the two
/// single-item GETs apply, so callers cannot probe for existence through the batch either.
/// </summary>
public class CaseStudyReportBatchItemDto
{
    public string ParentTaskId { get; set; } = "";

    /// <summary>The specialist's (non-party) form; an unsaved empty form when no row exists yet.</summary>
    public CaseStudyReportDto Parent { get; set; } = new();

    /// <summary>Party forms of the parent's child tasks, keyed by child workflow-task id.</summary>
    public Dictionary<string, CaseStudyReportDto> PartyContributionsByChildTaskId { get; set; } = new();
}

public class CaseStudyReportBatchDto
{
    /// <summary>Keyed by parent workflow-task id (lower-case <c>D</c> GUID format).</summary>
    public Dictionary<string, CaseStudyReportBatchItemDto> ByParentTaskId { get; set; } = new();
}
