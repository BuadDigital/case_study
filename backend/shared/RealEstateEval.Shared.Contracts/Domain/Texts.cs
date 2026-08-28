namespace RealEstateEval.Domain;

/// <summary>
/// تطبيع النصوص الاختيارية — كانت الدالة منسوخة بثمانية أسماء عبر خمسة سياقات
/// (NullIfBlank / NullIfEmpty / NormalizeOptionalText / Normalize / Clean).
/// </summary>
public static class Texts
{
    public static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

 /// <summary>الأرقام فقط — لتطبيع أرقام الجوال والمعرفات قبل المقارنة.</summary>
    public static string DigitsOnly(string value) =>
        new(value.Where(char.IsDigit).ToArray());

 /// <summary>تحقق البريد الموحّد — كان MailAddress في سياقٍ وregex في آخر بقبولين مختلفين.</summary>
    public static bool IsValidEmail(string email) =>
        System.Text.RegularExpressions.Regex.IsMatch(
            email,
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
}
