namespace RealEstateEval.Infrastructure.Data;

/// <summary>Default failure types catalog — mirrors apps/mfe-failures failure-types-data.ts.</summary>
internal static class FailureTypesCatalogSeed
{
    internal static readonly Guid SingletonId =
        Guid.Parse("c2d3e4f5-a6b7-8901-cdef-123456789012");

    internal const string CatalogJson = """
        {
          "categories": [
            { "id": "deed-documents", "label": "مشاكل الصك والوثائق", "order": 1 },
            { "id": "location", "label": "مشاكل تحديد الموقع والحدود", "order": 2 },
            { "id": "ownership", "label": "مشاكل الملكية والحدود المساحية", "order": 3 },
            { "id": "access", "label": "مشاكل الدخول والتمكين", "order": 4 },
            { "id": "contents", "label": "مشاكل محتوى العقار", "order": 5 },
            { "id": "parties", "label": "مشاكل الأطراف والتعاون", "order": 6 }
          ],
          "problemTypes": [
            { "id": "deed-suspended", "categoryId": "deed-documents", "label": "الصك موقوف", "order": 1 },
            { "id": "deed-inactive", "categoryId": "deed-documents", "label": "الصك غير فعال", "order": 2 },
            { "id": "unknown-location", "categoryId": "location", "label": "عدم معرفة موقع العقار", "description": "بدون قطعة / بدون مخطط في الصك، والمالك لا يعرف الموقع", "order": 3 },
            { "id": "unknown-boundaries", "categoryId": "location", "label": "عدم معرفة حدود العقار", "order": 4 },
            { "id": "property-overlap", "categoryId": "ownership", "label": "تداخل العقار", "description": "جزء من العقار داخل على حدود عقار آخر أو العكس", "order": 5 },
            { "id": "shared-property", "categoryId": "ownership", "label": "عقار مشترك", "description": "مبنى واحد على أرضين، فقط إحداهما مُسندة للمعاملة", "order": 6 },
            { "id": "key-wont-open", "categoryId": "access", "label": "مفتاح العقار لا يفتح", "order": 7 },
            { "id": "access-denied", "categoryId": "access", "label": "عدم تمكين دخول العقار", "description": "رفض دخول أو سكان بدون محظر تمكين أو عقد إيجار", "order": 8 },
            { "id": "movables-present", "categoryId": "contents", "label": "وجود منقولات في العقار", "description": "منقولات ذات قيمة أو مركبات", "order": 9 },
            { "id": "party-uncooperative", "categoryId": "parties", "label": "عدم تعاون أحد أطراف التنفيذ", "description": "عدم الرد، المماطلة، أو التهرب", "order": 10 },
            { "id": "location-declaration-refused", "categoryId": "parties", "label": "رفض توقيع إقرار صحة الموقع", "description": "من أحد أطراف التنفيذ أو من ينوبهم", "order": 11 }
          ]
        }
        """;
}
