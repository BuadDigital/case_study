namespace RealEstateEval.Domain;

/// <summary>مدينة/محافظة تابعة لمنطقة — دليل النظام.</summary>
public class City
{
    public Guid Id { get; set; }
    public Guid RegionId { get; set; }
    public string NameAr { get; set; } = "";
    public bool IsCapital { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }

    public Region? Region { get; set; }
}
