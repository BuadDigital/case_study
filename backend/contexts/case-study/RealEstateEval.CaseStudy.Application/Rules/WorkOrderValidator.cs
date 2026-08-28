using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using System.Net.Mail;

namespace RealEstateEval.CaseStudy.Application.Rules;

public static class WorkOrderValidator
{
    private const int DeedNumberDigitLength = 12;
    private const int RealEstateRegistrationDigitLength = 16;

    public static bool RequiresAssignmentDecree(AssignmentType type) =>
        AssignmentTypeRules.RequiresAssignmentDecree(type);

    public static Dictionary<string, string> ValidateHeader(CreateWorkOrderRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(request.PoNumber))
            errors["poNumber"] = "رقم PO مطلوب";
        if (!AssignmentTypeLabels.TryParseLabel(request.AssignmentType, out _))
            errors["assignmentType"] = "نوع الإسناد غير صالح";
        if (!DateOnly.TryParse(request.PromulgationDate, out _))
            errors["promulgationDate"] = "تاريخ التعميد غير صالح";
        ValidateOptionalSpecialistEmail(request.AssignmentSpecialistEmail, errors);
        if (request.ExpectedPropertyCount < 1)
            errors["expectedPropertyCount"] = "عدد العقارات يجب أن يكون 1 على الأقل";
        if (request.ClientId == Guid.Empty)
            errors["clientId"] = "العميل مطلوب";
        return errors;
    }

    public static Dictionary<string, string> ValidateUpdateHeader(UpdateWorkOrderHeaderRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (!AssignmentTypeLabels.TryParseLabel(request.AssignmentType, out _))
            errors["assignmentType"] = "نوع الإسناد غير صالح";
        if (!DateOnly.TryParse(request.PromulgationDate, out _))
            errors["promulgationDate"] = "تاريخ التعميد غير صالح";
        ValidateOptionalSpecialistEmail(request.AssignmentSpecialistEmail, errors);
        if (request.ExpectedPropertyCount < 1)
            errors["expectedPropertyCount"] = "عدد العقارات يجب أن يكون 1 على الأقل";
        if (request.ClientId == Guid.Empty)
            errors["clientId"] = "العميل مطلوب";
        return errors;
    }

 /// <summary>مرحلة إنفاذ — إضافة عقار داخل أمر العمل.</summary>
    public static Dictionary<string, string> ValidatePropertyEnfath(
        WorkOrderPropertyDto dto,
        AssignmentType assignmentType,
        string poNumber,
        Guid? excludePropertyId,
        Func<string, Guid?, bool> deedExistsInPo)
    {
        var errors = new Dictionary<string, string>();
        PropertyIdentifierTypeLabels.TryParseApiValue(dto.IdentifierType, out var idType);

        // خاص بكل مسار: تحقق المعرف + تاريخ الصك (استعلام البورصة) أو خطاب التفويض (الصك/السجل).
        if (idType == PropertyIdentifierType.BourseInquiry)
        {
            ValidateIdentifierNumber(dto, idType, errors);
            if (string.IsNullOrWhiteSpace(dto.DeedDate))
                errors["deedDate"] = "تاريخ الصك مطلوب";
        }
        else
        {
            ValidateDeedOrRealEstateReg(dto, errors);
            if (dto.DelegationLetterFileNames.All(string.IsNullOrWhiteSpace))
                errors["delegationLetterFileNames"] = "خطاب التفويض مطلوب";
        }

        ValidateSharedEnfathFields(dto, assignmentType, excludePropertyId, deedExistsInPo, errors);

 // ق-11: رقم الطلب ≠ رقم الصك تحوّل من قيد منع إلى تحقق تحذيري — التطابق الحرفي
 // وارد مصادفة وليس دليل خطأ قاطعاً؛ التنبيه في الواجهة والمُدخل يؤكد ويمضي.

        if (dto.AssignmentDocFileNames.All(string.IsNullOrWhiteSpace))
        {
            errors["assignmentDocFileNames"] = "خطاب الإسناد مطلوب";
        }

        ValidateContacts(dto, AssignmentTypeRules.RequiresContacts(assignmentType), errors);

        return errors;
    }

 /// <summary>الحقول المشتركة بين مسارَي إنفاذ (استعلام بورصة / صك أو سجل) — كانت مكررة في الفرعين.</summary>
    private static void ValidateSharedEnfathFields(
        WorkOrderPropertyDto dto,
        AssignmentType assignmentType,
        Guid? excludePropertyId,
        Func<string, Guid?, bool> deedExistsInPo,
        Dictionary<string, string> errors)
    {
        if (AssignmentTypeRules.RequiresRequestNumber(assignmentType) &&
            dto.HasRequestNumber &&
            string.IsNullOrWhiteSpace(dto.RequestNumber))
            errors["requestNumber"] = "رقم الطلب مطلوب";
        if (string.IsNullOrWhiteSpace(dto.AssignmentMandateNumber))
            errors["assignmentMandateNumber"] = "رقم التكليف مطلوب";
        if (string.IsNullOrWhiteSpace(dto.AssignmentMandateDate))
            errors["assignmentMandateDate"] = "تاريخ التكليف مطلوب";
        if (string.IsNullOrWhiteSpace(dto.OwnerName))
            errors["ownerName"] = "اسم المالك مطلوب";
        if (AssignmentTypeRules.RequiresCourtAndCircuit(assignmentType))
        {
            if (string.IsNullOrWhiteSpace(dto.Court))
                errors["court"] = "المحكمة مطلوبة";
            if (string.IsNullOrWhiteSpace(dto.Circuit))
                errors["circuit"] = "الدائرة مطلوبة";
        }

        if (!string.IsNullOrWhiteSpace(dto.DeedNumber) &&
            deedExistsInPo(dto.DeedNumber.Trim(), excludePropertyId))
        {
            errors["deedNumber"] = "رقم الصك مسجّل مسبقاً في هذا أمر العمل";
        }
    }

 /// <summary>مرحلة البورصة — استعلام البورصة.</summary>
    public static Dictionary<string, string> ValidatePropertyBourse(UpdatePropertyBourseRequest dto)
    {
        var errors = new Dictionary<string, string>();

        if (string.IsNullOrWhiteSpace(dto.City))
            errors["city"] = "المدينة مطلوبة";
        if (string.IsNullOrWhiteSpace(dto.District))
            errors["district"] = "الحي مطلوب";
        if (string.IsNullOrWhiteSpace(dto.BourseDeedImageFileName))
            errors["bourseDeedImageFileName"] = "صورة الصك من البورصة مطلوبة";

        if (!string.IsNullOrWhiteSpace(dto.RestrictionsPresent))
        {
            var r = dto.RestrictionsPresent.Trim().ToLowerInvariant();
            if (r is not "yes" and not "no")
                errors["restrictionsPresent"] = "قيمة القيود غير صالحة";
        }

        var hasRestrictions = string.Equals(
            dto.RestrictionsPresent?.Trim(),
            "yes",
            StringComparison.OrdinalIgnoreCase);
        var restrictionTypes = ParseRestrictionTypes(dto.RestrictionType);
        if (hasRestrictions)
        {
            if (restrictionTypes.Count == 0)
                errors["restrictionType"] = "اختر نوع قيد واحداً على الأقل";
            else if (restrictionTypes.Contains("other") &&
                     string.IsNullOrWhiteSpace(dto.RestrictionOtherReason))
                errors["restrictionOtherReason"] = "سبب القيد مطلوب عند اختيار أخرى";
        }
        else if (!string.IsNullOrWhiteSpace(dto.RestrictionType) && restrictionTypes.Count == 0)
        {
            errors["restrictionType"] = "قيمة نوع القيد غير صالحة";
        }

        if (!string.IsNullOrWhiteSpace(dto.BoundariesAvailability))
        {
            var b = dto.BoundariesAvailability.Trim().ToLowerInvariant();
            if (b is not "deed" and not "bourse" and not "doc" and not "no")
                errors["boundariesAvailability"] = "قيمة توفر الحدود غير صالحة";
        }

        return errors;
    }

    private static void ValidateDeedOrRealEstateReg(
        WorkOrderPropertyDto dto,
        Dictionary<string, string> errors)
    {
        var hasDeed = !string.IsNullOrWhiteSpace(dto.DeedNumber);
        var hasReg = !string.IsNullOrWhiteSpace(dto.RealEstateRegNumber);

 // مطلوب أحدهما على الأقل: رقم الصك أو التسجيل العيني (أو كلاهما).
 // التسجيل العيني عند التعبئة يتجاوز استعلام البورصة.
        if (!hasDeed && !hasReg)
        {
            const string msg = "أدخل رقم الصك أو رقم التسجيل العيني";
            errors["deedNumber"] = msg;
            errors["realEstateRegNumber"] = msg;
            return;
        }

        if (hasDeed)
        {
            var digits = NormalizeIdentifierDigits(dto.DeedNumber);
            if (digits.Length != DeedNumberDigitLength)
                errors["deedNumber"] = $"رقم الصك يجب أن يكون {DeedNumberDigitLength} رقماً";
        }

        if (hasReg)
        {
            var regDigits = NormalizeIdentifierDigits(dto.RealEstateRegNumber!);
            if (regDigits.Length != RealEstateRegistrationDigitLength)
            {
                errors["realEstateRegNumber"] =
                    $"تسجيل عيني يجب أن يكون {RealEstateRegistrationDigitLength} رقماً";
            }
            if (string.IsNullOrWhiteSpace(dto.RealEstateRegDate))
                errors["realEstateRegDate"] = "تاريخ التسجيل العيني مطلوب";
            if (string.IsNullOrWhiteSpace(dto.RealEstateRegFileName))
            {
                errors["realEstateRegFileName"] =
                    "ارفع السجل العقاري كمرفق (يُطلب من أطراف التنفيذ)";
            }
        }
    }

    private static void ValidateIdentifierNumber(
        WorkOrderPropertyDto dto,
        PropertyIdentifierType idType,
        Dictionary<string, string> errors)
    {
 // رقم الصك دائماً 12 رقماً — التسجيل العيني حقل منفصل.
        _ = idType;
        const string label = "رقم الصك";
        const int requiredLength = DeedNumberDigitLength;

        if (string.IsNullOrWhiteSpace(dto.DeedNumber))
        {
            errors["deedNumber"] = $"{label} مطلوب";
            return;
        }

        var digits = NormalizeIdentifierDigits(dto.DeedNumber);
        if (digits.Length != requiredLength)
        {
            errors["deedNumber"] = $"{label} يجب أن يكون {requiredLength} رقماً";
        }
    }

    private static string NormalizeIdentifierDigits(string value) =>
        Texts.DigitsOnly(value);

    private static readonly HashSet<string> AllowedRestrictionTypes = new(StringComparer.Ordinal)
    {
        "mortgaged", "seized", "suspended", "other",
    };

    private static List<string> ParseRestrictionTypes(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return [];
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var list = new List<string>();
        foreach (var part in value.Split([',', '،'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var v = part.ToLowerInvariant();
            if (!AllowedRestrictionTypes.Contains(v) || !seen.Add(v)) continue;
            list.Add(v);
        }
        return list;
    }

    private static void ValidateContacts(
        WorkOrderPropertyDto dto,
        bool requireAtLeastOne,
        Dictionary<string, string> errors)
    {
        var hasContact = false;
        for (var i = 0; i < dto.Contacts.Count; i++)
        {
            var c = dto.Contacts[i];
            var phones = SplitPhones(c.Phone);
            var role = c.Role.Trim();
            if (phones.Count == 0 && string.IsNullOrEmpty(role))
                continue;
            if (phones.Count == 0)
                errors[$"contact_phone_{i}"] = "رقم الجوال مطلوب";
            else if (phones.Any(p => CountPhoneDigits(p) < 10))
                errors[$"contact_phone_{i}"] =
                    "كل رقم جوال يجب أن يكون 10 أرقام على الأقل (افصل بينها بمسافة)";
            if (string.IsNullOrEmpty(role))
                errors[$"contact_role_{i}"] = "صفة الضابط مطلوبة";
            if (phones.Count > 0 &&
                phones.All(p => CountPhoneDigits(p) >= 10) &&
                !string.IsNullOrEmpty(role))
                hasContact = true;
        }
        if (requireAtLeastOne && !hasContact)
            errors["_contacts"] = "أضف ضابط اتصال واحداً على الأقل (جوال + صفة)";
    }

    private static List<string> SplitPhones(string? phone) =>
        (phone ?? "")
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Select(Texts.DigitsOnly)
            .Where(p => p.Length > 0)
            .ToList();

    private static int CountPhoneDigits(string phone) =>
        phone.Count(char.IsDigit);

    private static void ValidateOptionalSpecialistEmail(
        string? email,
        Dictionary<string, string> errors)
    {
        if (string.IsNullOrWhiteSpace(email)) return;
        if (!IsValidEmail(email))
            errors["assignmentSpecialistEmail"] = "صيغة الإيميل غير صالحة";
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            _ = new MailAddress(email.Trim());
            return true;
        }
        catch
        {
            return false;
        }
    }
}
