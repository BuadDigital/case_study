using System.Text.Json;

namespace RealEstateEval.Domain;

/// <summary>
/// خيارات System.Text.Json المشتركة — كانت مكررة كحقول ساكنة في ١٧ ملفاً بأربعة أشكال.
/// الحقول للقراءة فقط ولا تُعدَّل بعد أول استخدام (JsonSerializerOptions تتجمد عند أول Serialize).
/// </summary>
public static class JsonDefaults
{
 /// <summary>camelCase كتابةً + قراءة غير حساسة لحالة الأحرف — شكل حمولات الواجهة.</summary>
    public static readonly JsonSerializerOptions CamelCaseInsensitive = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

 /// <summary>camelCase كتابةً فقط.</summary>
    public static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

 /// <summary>قراءة غير حساسة لحالة الأحرف مع أسماء الخصائص كما هي.</summary>
    public static readonly JsonSerializerOptions CaseInsensitive = new()
    {
        PropertyNameCaseInsensitive = true,
    };

 /// <summary>بلا تهريب للعربية داخل النص المخزن (لقطات تُقرأ يدوياً).</summary>
    public static readonly JsonSerializerOptions RelaxedEscaping = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

 /// <summary>افتراضات الويب الكاملة (camelCase + غير حساسة + أرقام من نصوص).</summary>
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
}
