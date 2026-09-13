namespace RealEstateEval.Application.Contracts;

/// <summary>Last person who changed one organization-settings section.</summary>
public sealed class OrganizationSettingsSectionEditorDto
{
    public string Name { get; set; } = "";
    public bool CanNotify { get; set; }
    public DateTime? EditedAtUtc { get; set; }
}

/// <summary>Per settings tab that feeds the valuation report: company, evaluator (valuers), report.</summary>
public sealed class OrganizationSettingsSectionEditorsDto
{
    public OrganizationSettingsSectionEditorDto Company { get; set; } = new();
    public OrganizationSettingsSectionEditorDto Evaluator { get; set; } = new();
    public OrganizationSettingsSectionEditorDto Report { get; set; } = new();
}

/// <summary>The valuation report prints an organization-settings value empty.</summary>
public sealed class NotifyOrganizationSettingsGapRequest
{
    /// <summary>company | evaluator | report.</summary>
    public string Section { get; set; } = "";
    public string FieldLabel { get; set; } = "";
    public string? FieldKey { get; set; }
    public string? PoNumber { get; set; }
}

public sealed class NotifyOrganizationSettingsGapResultDto
{
    public int NotifiedCount { get; set; }
    public string RecipientName { get; set; } = "";
}
