namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// One case-study parent with its party children — the batch shape behind
/// <c>GET /api/case-study-forms/batch</c>. A parent the actor may not read (or that does not
/// exist) is simply absent from <see cref="CaseStudyFormBatchDto.ByParentTaskId"/>; a child the
/// actor may not read is absent from <see cref="PartyFormsByChildTaskId"/>. Same rule the two
/// single-item GETs apply, so callers cannot probe for existence through the batch either.
/// </summary>
public class CaseStudyFormBatchItemDto
{
    public string ParentTaskId { get; set; } = "";

    /// <summary>The specialist's (non-party) form; an unsaved empty form when no row exists yet.</summary>
    public CaseStudyFormDto Parent { get; set; } = new();

    /// <summary>Party forms of the parent's child tasks, keyed by child workflow-task id.</summary>
    public Dictionary<string, CaseStudyFormDto> PartyFormsByChildTaskId { get; set; } = new();
}

public class CaseStudyFormBatchDto
{
    /// <summary>Keyed by parent workflow-task id (lower-case <c>D</c> GUID format).</summary>
    public Dictionary<string, CaseStudyFormBatchItemDto> ByParentTaskId { get; set; } = new();
}
