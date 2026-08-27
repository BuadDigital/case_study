namespace RealEstateEval.Platform.Domain;

/// <summary>حالة اعتماد المسمّى في دليل المواقع.</summary>
public static class LocationCatalogStatuses
{
    public const string Approved = "approved";
    public const string Pending = "pending";
    public const string Merged = "merged";
}

/// <summary>منطقة إدارية — دليل النظام (لا حذف نهائي؛ يُعطَّل عبر IsActive).</summary>
public class Region
{
    public Guid Id { get; set; }
 /// <summary>المعرّف الإداري 1–13 من الحزمة التأسيسية.</summary>
    public int OfficialId { get; set; }
 /// <summary>رمز المنطقة (RD, MK, …).</summary>
    public string Code { get; set; } = "";
 /// <summary>معرّف المنطقة في المصدر الرسمي (العنوان الوطني).</summary>
    public int AdminAreaId { get; set; }
    public string NameAr { get; set; } = "";
    public string CapitalAr { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }

    public List<City> Cities { get; set; } = [];
}

/// <summary>مدينة/قرية تابعة لمنطقة — دليل النظام.</summary>
public class City
{
    public Guid Id { get; set; }
 /// <summary>المعرّف الرسمي كما في العنوان الوطني — null للمسميات المبدئية.</summary>
    public int? OfficialId { get; set; }
    public Guid RegionId { get; set; }
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
 /// <summary>اسم مطبّع للبحث.</summary>
    public string NameSearch { get; set; } = "";
    public bool IsGovernorate { get; set; }
    public bool IsCapital { get; set; }
 /// <summary>approved | pending | merged</summary>
    public string Status { get; set; } = LocationCatalogStatuses.Approved;
    public string? RawInput { get; set; }
    public string? CreatedByUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewedByUserId { get; set; }
    public Guid? MergedIntoCityId { get; set; }
    public int? DuplicateOfOfficialId { get; set; }
    public int UsageCount { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }

    public Region? Region { get; set; }
    public City? MergedIntoCity { get; set; }
    public List<District> Districts { get; set; } = [];
}

/// <summary>حي تابع لمدينة — يبدأ فارغاً ويُبنى من إدخالات المستخدمين.</summary>
public class District
{
    public Guid Id { get; set; }
    public Guid CityId { get; set; }
    public string NameAr { get; set; } = "";
    public string NameSearch { get; set; } = "";
 /// <summary>approved | pending | merged</summary>
    public string Status { get; set; } = LocationCatalogStatuses.Pending;
    public string? RawInput { get; set; }
    public string? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewedByUserId { get; set; }
    public Guid? MergedIntoDistrictId { get; set; }
    public int UsageCount { get; set; }
    public bool IsActive { get; set; } = true;

    public City? City { get; set; }
    public District? MergedIntoDistrict { get; set; }
}
