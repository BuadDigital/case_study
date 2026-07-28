namespace RealEstateEval.Domain;

/// <summary>منطقة إدارية — دليل النظام (لا حذف نهائي؛ يُعطَّل عبر IsActive).</summary>
public class Region
{
    public Guid Id { get; set; }
    /// <summary>رمز المنطقة (RD, MK, …).</summary>
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string CapitalAr { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }

    public List<City> Cities { get; set; } = [];
}
