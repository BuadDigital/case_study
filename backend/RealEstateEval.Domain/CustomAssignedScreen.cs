namespace RealEstateEval.Domain;

/// <summary>Sidebar screen entry created by CDO and assigned to specific users.</summary>
public class CustomAssignedScreen
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Prototype page route when linked; empty = dynamic screen.</summary>
    public string TargetPageId { get; set; } = "";
    public string? IconPath { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    /// <summary>Stable screen code e.g. SCR-01.</summary>
    public string Code { get; set; } = "";
    /// <summary>Prototype role that owns/fills this screen.</summary>
    public string OwnerRole { get; set; } = "";
    /// <summary>مخططة | موجودة</summary>
    public string ScreenStatus { get; set; } = "مخططة";
    /// <summary>Fields, bindings, and layout JSON.</summary>
    public string DefinitionJson { get; set; } = "{}";
    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public ICollection<CustomAssignedScreenUser> Assignments { get; set; } = [];
    public ICollection<CustomScreenSubmission> Submissions { get; set; } = [];
}
