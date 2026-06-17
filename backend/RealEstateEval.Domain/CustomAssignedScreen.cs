namespace RealEstateEval.Domain;

/// <summary>Sidebar screen entry created by CDO and assigned to specific users.</summary>
public class CustomAssignedScreen
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Prototype page route when linked; empty = placeholder screen.</summary>
    public string TargetPageId { get; set; } = "";
    public string? IconPath { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public ICollection<CustomAssignedScreenUser> Assignments { get; set; } = [];
}
