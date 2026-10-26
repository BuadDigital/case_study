using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Extensions.DependencyInjection;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// The one place every API host turns an invalid request into its 400 (the automatic model-state
/// filter, <c>ValidationProblem(ModelState)</c> and the FluentValidation filter all come here):
/// a value the JSON reader cannot convert («abc» or "1,000" for a number) answers in Arabic, keyed
/// by the field path the screens target (<c>lines[0].unitCostSar</c>), instead of «The JSON value
/// could not be converted to System.Decimal …». The framework's generic English messages (required,
/// maximum / minimum length, range, invalid value, missing body) are rewritten in Arabic too — the
/// model-state key is kept so the screens still map the error onto its field — and the title is
/// Arabic. The derived «The request field is required.» that follows a failed body read is dropped;
/// messages already in Arabic (the DTOs' own <c>ErrorMessage</c>s) pass through unchanged.
/// </summary>
public static partial class ArabicInvalidModelState
{
    public const string TitleAr = "تعذّر قبول الطلب — راجع الحقول المذكورة";

    public const string BodyUnreadableAr = "تعذّرت قراءة بيانات الطلب — تحقّق من صيغة القيم المرسلة";

    public const string BodyMissingAr = "بيانات الطلب مطلوبة — أرسل الحقول المطلوبة";

    public static string FieldValueInvalidAr(string field) =>
        $"قيمة الحقل «{field}» غير صالحة — أدخل الأرقام بأرقام لاتينية دون فواصل، وكل قيمة بنوعها الصحيح";

    public static string FieldRequiredAr(string field) => $"الحقل «{field}» مطلوب";

    public static string FieldTooLongAr(string field, string max) =>
        $"الحقل «{field}» يتجاوز الحد الأقصى ({max} حرفاً)";

    public static string FieldTooShortAr(string field, string min) =>
        $"الحقل «{field}» أقصر من الحد الأدنى ({min} أحرف)";

    public static string FieldOutOfRangeAr(string field, string min, string max) =>
        $"قيمة الحقل «{field}» يجب أن تكون بين {min} و {max}";

    public static string FieldFormatInvalidAr(string field) => $"صيغة الحقل «{field}» غير صالحة";

    public static IActionResult Create(ActionContext context)
    {
        var translated = Translate(context.ModelState);
        var factory = context.HttpContext.RequestServices.GetService<ProblemDetailsFactory>();
        var problem = factory?.CreateValidationProblemDetails(
                          context.HttpContext, translated, StatusCodes.Status400BadRequest)
                      ?? new ValidationProblemDetails(translated) { Status = StatusCodes.Status400BadRequest };
        problem.Title = TitleAr;
        var messages = problem.Errors.Values.SelectMany(v => v).Where(m => !string.IsNullOrWhiteSpace(m)).ToList();
        if (messages.Count > 0)
        {
            problem.Detail = ApiProblemExtensions.JoinMessages(messages);
            problem.Extensions[ApiProblemExtensions.LegacyErrorMember] = messages[0];
            problem.Extensions[ApiProblemExtensions.LegacyMessageMember] = messages[0];
        }

        var result = new BadRequestObjectResult(problem);
        result.ContentTypes.Add("application/problem+json");
        result.ContentTypes.Add("application/json");
        return result;
    }

    /// <summary>Model state with every framework message rewritten in Arabic (pure — testable without a host).</summary>
    public static ModelStateDictionary Translate(ModelStateDictionary modelState)
    {
        var result = new ModelStateDictionary();
        var entries = modelState
            .Where(e => e.Value is { Errors.Count: > 0 })
            .Select(e => (e.Key, Errors: e.Value!.Errors.ToList()))
            .ToList();
        var bodyUnreadable = entries.Any(e => e.Errors.Any(err => IsJsonError(e.Key, err)));
        var bodyMissing = !bodyUnreadable
            && entries.Any(e => e.Errors.Any(err => IsMissingBody(err.ErrorMessage)));

        foreach (var (key, errors) in entries)
        {
            foreach (var error in errors)
            {
                if (IsJsonError(key, error))
                {
                    var field = FieldOf(key);
                    result.TryAddModelError(
                        field.Length == 0 ? "_" : field,
                        field.Length == 0 ? BodyUnreadableAr : FieldValueInvalidAr(field));
                }
                else if (IsMissingBody(error.ErrorMessage))
                {
                    result.TryAddModelError(key.Length == 0 ? "_" : key, BodyMissingAr);
                }
                else if (!((bodyUnreadable || bodyMissing) && IsDerivedRequiredBody(error)))
                {
                    result.TryAddModelError(key, MessageAr(key, error.ErrorMessage));
                }
            }
        }

        if (result.ErrorCount == 0 && bodyUnreadable)
            result.TryAddModelError("_", BodyUnreadableAr);
        return result;
    }

    /// <summary>
    /// One model-state message in Arabic: already-Arabic text unchanged; the framework's English
    /// templates rewritten with the field's name (its Arabic display name when it has one, else the
    /// camelCase key the screens use); any other English text → «قيمة الحقل … غير صالحة».
    /// </summary>
    public static string MessageAr(string key, string? message)
    {
        var text = (message ?? "").Trim();
        if (ContainsArabic(text)) return text;
        var field = DisplayField(key);

        Match m;
        if ((m = RequiredRegex().Match(text)).Success || (m = NotProvidedRegex().Match(text)).Success)
            return FieldRequiredAr(NameOf(m.Groups["f"].Value, field));
        if ((m = MaxLengthRegex().Match(text)).Success)
            return FieldTooLongAr(NameOf(m.Groups["f"].Value, field), m.Groups["n"].Value);
        if ((m = MinLengthRegex().Match(text)).Success)
            return FieldTooShortAr(NameOf(m.Groups["f"].Value, field), m.Groups["n"].Value);
        if ((m = RangeRegex().Match(text)).Success)
            return FieldOutOfRangeAr(NameOf(m.Groups["f"].Value, field), m.Groups["a"].Value, m.Groups["b"].Value);
        if ((m = FormatRegex().Match(text)).Success)
            return FieldFormatInvalidAr(NameOf(m.Groups["f"].Value, field));
        return field.Length == 0 ? BodyUnreadableAr : FieldValueInvalidAr(field);
    }

    private static bool ContainsArabic(string text) =>
        text.Any(c => c is >= '؀' and <= 'ۿ');

    /// <summary>The name in the framework message when it is Arabic (a <c>[Display]</c> name), else the key.</summary>
    private static string NameOf(string fromMessage, string fromKey) =>
        ContainsArabic(fromMessage) || fromKey.Length == 0 ? fromMessage.Trim() : fromKey;

    /// <summary>«Lines» → «lines», «Items[0].Rationale» → «items[0].rationale», «$.x» → «x».</summary>
    private static string DisplayField(string key)
    {
        var field = FieldOf(key);
        if (field.Length == 0) return "";
        return string.Join(".", field.Split('.').Select(part =>
            part.Length > 0 && char.IsUpper(part[0])
                ? char.ToLower(part[0], CultureInfo.InvariantCulture) + part[1..]
                : part));
    }

    private static bool IsJsonError(string key, ModelError error) =>
        key.StartsWith('$')
        || error.Exception is JsonException or InputFormatterException
        || error.ErrorMessage.Contains("The JSON value", StringComparison.Ordinal);

    private static bool IsMissingBody(string? message) =>
        (message ?? "").StartsWith("A non-empty request body is required", StringComparison.Ordinal);

    /// <summary>«The request field is required.» — the parameter left null by the failed body read.</summary>
    private static bool IsDerivedRequiredBody(ModelError error) =>
        error.ErrorMessage.StartsWith("The ", StringComparison.Ordinal)
        && error.ErrorMessage.EndsWith(" field is required.", StringComparison.Ordinal);

    /// <summary>«$.lines[0].unitCostSar» → «lines[0].unitCostSar»; «$» → «».</summary>
    private static string FieldOf(string key)
    {
        var field = key.TrimStart('$');
        return field.StartsWith('.') ? field[1..] : field;
    }

    [GeneratedRegex(@"^The (?<f>.+?) field is required\.?$")]
    private static partial Regex RequiredRegex();

    [GeneratedRegex(@"^A value for the '(?<f>.+?)' (parameter or property|property) was not provided\.?$")]
    private static partial Regex NotProvidedRegex();

    [GeneratedRegex(@"^The field (?<f>.+?) must be a string (or array type )?with a maximum length of '?(?<n>\d+)'?\.?$")]
    private static partial Regex MaxLengthRegex();

    [GeneratedRegex(@"^The field (?<f>.+?) must be a string (or array type )?with a minimum length of '?(?<n>\d+)'?\.?$")]
    private static partial Regex MinLengthRegex();

    [GeneratedRegex(@"^The field (?<f>.+?) must be between (?<a>\S+) and (?<b>\S+?)\.?$")]
    private static partial Regex RangeRegex();

    [GeneratedRegex(@"^The (field )?(?<f>.+?) (field )?(is not a valid|must match the regular expression).*$")]
    private static partial Regex FormatRegex();
}
