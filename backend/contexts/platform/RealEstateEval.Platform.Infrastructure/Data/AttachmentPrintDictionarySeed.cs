namespace RealEstateEval.Platform.Infrastructure.Data;

/// <summary>
/// Default report attachment types — صك، رفع مساحي، كروكي تنظيمي، رخصة المباني (ف).
/// </summary>
internal static class AttachmentPrintDictionarySeed
{
    internal static readonly Guid SingletonId =
        Guid.Parse("a7b8c9d0-e1f2-4301-8456-7890abcdef12");

    internal const string CatalogJson = """
        {
          "types": [
            {
              "id": "deed",
              "key": "deed",
              "labelAr": "الصك",
              "propertyTypeKeys": [],
              "isRequired": true,
              "isSystemDefault": true,
              "sortOrder": 1,
              "isActive": true
            },
            {
              "id": "survey",
              "key": "survey",
              "labelAr": "الرفع المساحي",
              "propertyTypeKeys": [],
              "isRequired": false,
              "isSystemDefault": true,
              "sortOrder": 2,
              "isActive": true
            },
            {
              "id": "zoning-sketch",
              "key": "zoning-sketch",
              "labelAr": "الكروكي التنظيمي",
              "propertyTypeKeys": [],
              "isRequired": false,
              "isSystemDefault": true,
              "sortOrder": 3,
              "isActive": true
            },
            {
              "id": "building-permit",
              "key": "building-permit",
              "labelAr": "رخصة المباني",
              "propertyTypeKeys": ["فيلا", "عمارة", "شقة", "محل تجاري", "مستودع"],
              "isRequired": false,
              "isSystemDefault": true,
              "sortOrder": 4,
              "isActive": true
            },
            {
              "id": "photo",
              "key": "photo",
              "labelAr": "صور العقار",
              "propertyTypeKeys": [],
              "isRequired": false,
              "isSystemDefault": true,
              "sortOrder": 5,
              "isActive": true
            },
            {
              "id": "site-map",
              "key": "site-map",
              "labelAr": "خريطة الموقع",
              "propertyTypeKeys": [],
              "isRequired": false,
              "isSystemDefault": true,
              "sortOrder": 6,
              "isActive": true
            }
          ]
        }
        """;
}
