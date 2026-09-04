using System.Text.RegularExpressions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Identity.Application.Rules;

internal static class StaffUserRules
{
 /// <summary>Guards shared by disabling through PATCH and through the delete endpoint.</summary>
    internal static string? DisableRefusalReason(
        string? accountEmail,
        string? accountUserName,
        string userId,
        string? requestingUserId)
    {
        if (!string.IsNullOrWhiteSpace(requestingUserId)
            && string.Equals(userId, requestingUserId, StringComparison.Ordinal))
        {
            return "لا يمكنك تعطيل حسابك الحالي.";
        }

        var email = (accountEmail ?? "").Trim().ToLowerInvariant();
        var userName = (accountUserName ?? "").Trim().ToLowerInvariant();
        return email is "admin@local.dev" or "s.salhy@gmail.com"
               || userName is "sliman" or "admin"
            ? "لا يمكن تعطيل حساب المسؤول الأساسي."
            : null;
    }

    internal static Dictionary<string, string> FormError(string message, string field = "_form") =>
        new(StringComparer.Ordinal) { [field] = message };

    internal static string? ResolveOptional(string? requested, string? current) =>
        requested is null
            ? current
            : requested.Trim().Length == 0 ? null : requested.Trim();

    internal static Dictionary<string, string> ValidateCreateStaffRequest(CreateStaffUserRequest request)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(request.DisplayName))
            errors["displayName"] = "الاسم مطلوب.";
        if (string.IsNullOrWhiteSpace(request.Email))
            errors["email"] = "البريد الإلكتروني مطلوب.";
        else if (!IsValidEmail(request.Email.Trim()))
            errors["email"] = "صيغة البريد الإلكتروني غير صحيحة.";
        if (string.IsNullOrWhiteSpace(request.Mobile))
            errors["mobile"] = "رقم الجوال مطلوب.";
        else if (NormalizeMobile(request.Mobile) is null)
            errors["mobile"] = "صيغة رقم الجوال السعودي غير صحيحة (05XXXXXXXX).";
        if (string.IsNullOrWhiteSpace(request.City))
            errors["city"] = "المدينة مطلوبة.";
        if (string.IsNullOrWhiteSpace(request.NationalId))
            errors["nationalId"] = "رقم الهوية مطلوب.";
        else if (!Regex.IsMatch(request.NationalId.Trim(), @"^[12]\d{9}$"))
            errors["nationalId"] = "رقم الهوية يجب أن يتكون من 10 أرقام.";
        if (string.IsNullOrWhiteSpace(request.RoleId))
            errors["roleId"] = "الدور مطلوب.";
        else if (!StaffRoleCatalog.IsCreatableStaffRoleId(request.RoleId))
            errors["roleId"] = "الدور المحدد غير مدعوم.";
        else if (request.RoleId.Trim() == "field-inspector"
                 && request.InspectorType?.Trim().ToLowerInvariant()
                     is not ("employee" or "contractor"))
            errors["inspectorType"] = "نوع المعاين مطلوب.";
        if (request.FeeValueSar is < 0)
            errors["feeValueSar"] = "قيمة الأتعاب لا يمكن أن تكون سالبة.";
        if (request.HasCompensation == true && request.FeeValueSar is null)
            errors["feeValueSar"] = "قيمة الأتعاب مطلوبة عند تفعيل التعويض.";
        if (!string.IsNullOrWhiteSpace(request.Iban)
            && !Regex.IsMatch(request.Iban.Trim().Replace(" ", ""), @"^SA\d{22}$",
                RegexOptions.IgnoreCase))
            errors["iban"] = "صيغة الآيبان السعودي غير صحيحة.";

        return errors;
    }

    private static bool IsValidEmail(string email) => Texts.IsValidEmail(email);

 // Q3: strict Saudi normalization shared with login — SaudiMobiles.Normalize.
    internal static string? NormalizeMobile(string mobile) =>
        SaudiMobiles.Normalize(mobile);

    internal static string DeriveUserNameFromEmail(string normalizedEmail)
    {
        var local = normalizedEmail.Split('@')[0].Trim().ToLowerInvariant();
        var sanitized = Regex.Replace(local, @"[^a-z0-9._-]", "_");
        sanitized = sanitized.Trim('_', '.', '-');
        if (string.IsNullOrWhiteSpace(sanitized))
            sanitized = "user";
        return sanitized.Length > 50 ? sanitized[..50] : sanitized;
    }

    internal static string BuildDistributionAssigneeId(string roleId, string userName)
    {
        var prefix = roleId switch
        {
            "cdo" => "cdo",
            "general-manager" => "gm",
            "section-supervisor" => "ss",
            "case-specialist" => "cs",
            "government-reviewer" => "gov",
            "real-estate-appraiser" => "val",
            "field-inspector" => "fi",
            "financial-officer" => "fo",
            _ => "usr",
        };

        var slug = Regex.Replace(userName.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(slug))
            slug = "user";

        return $"{prefix}-{slug}";
    }
}
