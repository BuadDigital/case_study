namespace RealEstateEval.Domain;

/// <summary>محكمة — دليل النظام (لا حذف نهائي؛ يُعطَّل عبر IsActive).</summary>
public class Court
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Region { get; set; } = "";
    public string City { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    public List<CourtCircuit> Circuits { get; set; } = [];
}
