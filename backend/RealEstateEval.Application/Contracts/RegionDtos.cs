namespace RealEstateEval.Application.Contracts;

public sealed class SelectableRegionDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string CapitalAr { get; set; } = "";
}

public sealed class SelectableCityDto
{
    public Guid Id { get; set; }
    public Guid RegionId { get; set; }
    public string NameAr { get; set; } = "";
    public bool IsCapital { get; set; }
    /// <summary>اسم المنطقة — مفيد عند اختيار المدينة أولاً.</summary>
    public string RegionNameAr { get; set; } = "";
}
