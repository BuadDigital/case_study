namespace RealEstateEval.Domain;

/// <summary>دائرة تابعة لمحكمة — لا حذف نهائي؛ يُعطَّل عبر IsActive.</summary>
public class CourtCircuit
{
    public Guid Id { get; set; }
    public Guid CourtId { get; set; }
    public string CircuitNo { get; set; } = "";
    public string? CircuitName { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    public Court? Court { get; set; }
}
