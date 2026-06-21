using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using System.Net.Mail;

namespace RealEstateEval.Application.Rules;

public static class WorkOrderValidator
{
    public static bool RequiresAssignmentDecree(AssignmentType type) =>
        type == AssignmentType.Execution;

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

        if (idType == PropertyIdentifierType.BourseInquiry)
        {
            if (string.IsNullOrWhiteSpace(dto.DeedNumber))
                errors["deedNumber"] = "رقم الصك مطلوب";
            if (string.IsNullOrWhiteSpace(dto.TaskNumber))
                errors["taskNumber"] = "رقم المهمة مطلوب";
            if (string.IsNullOrWhiteSpace(dto.DeedDate))
                errors["deedDate"] = "تاريخ الصك مطلوب";
            if (string.IsNullOrWhiteSpace(dto.OwnerName))
                errors["ownerName"] = "اسم المالك مطلوب";
            if (string.IsNullOrWhiteSpace(dto.Court))
                errors["court"] = "المحكمة مطلوبة";
            if (string.IsNullOrWhiteSpace(dto.Circuit))
                errors["circuit"] = "الدائرة مطلوبة";

            if (!string.IsNullOrWhiteSpace(dto.DeedNumber) &&
                deedExistsInPo(dto.DeedNumber.Trim(), excludePropertyId))
            {
                errors["deedNumber"] = "رقم الصك مسجّل مسبقاً في هذا أمر العمل";
            }
        }
        else
        {
            if (string.IsNullOrWhiteSpace(dto.DeedNumber))
            {
                errors["deedNumber"] = idType == PropertyIdentifierType.RealEstateRegistration
                    ? "رقم التسجيل العيني مطلوب"
                    : "رقم الصك مطلوب";
            }

            if (string.IsNullOrWhiteSpace(dto.TaskNumber))
                errors["taskNumber"] = "رقم المهمة مطلوب";
            if (string.IsNullOrWhiteSpace(dto.DeedDate))
                errors["deedDate"] = "تاريخ الصك مطلوب";
            if (string.IsNullOrWhiteSpace(dto.OwnerName))
                errors["ownerName"] = "اسم المالك مطلوب";
            if (string.IsNullOrWhiteSpace(dto.DelegationLetterFileName))
                errors["delegationLetterFileName"] = "خطاب التفويض مطلوب";

            if (idType == PropertyIdentifierType.RealEstateRegistration &&
                string.IsNullOrWhiteSpace(dto.RealEstateRegFileName))
            {
                errors["realEstateRegFileName"] =
                    "ارفع السجل العقاري كمرفق (يُطلب من أطراف التنفيذ)";
            }

            if (!string.IsNullOrWhiteSpace(dto.DeedNumber) &&
                deedExistsInPo(dto.DeedNumber.Trim(), excludePropertyId))
            {
                errors["deedNumber"] = "رقم الصك مسجّل مسبقاً في هذا أمر العمل";
            }
        }

        if (RequiresAssignmentDecree(assignmentType) &&
            string.IsNullOrWhiteSpace(dto.AssignmentDocFileName))
        {
            errors["assignmentDocFileName"] =
                "ارفع قرار الإسناد الخاص بهذا العقار (مطلوب لمسار التنفيذ)";
        }

        ValidateContacts(dto, errors);

        return errors;
    }

    /// <summary>مرحلة البورصة — استعلام البورصة.</summary>
    public static Dictionary<string, string> ValidatePropertyBourse(UpdatePropertyBourseRequest dto)
    {
        var errors = new Dictionary<string, string>();

        if (string.IsNullOrWhiteSpace(dto.City))
            errors["city"] = "المدينة مطلوبة";
        if (string.IsNullOrWhiteSpace(dto.District))
            errors["district"] = "الحي مطلوب";
        if (string.IsNullOrWhiteSpace(dto.Classification))
            errors["classification"] = "التصنيف مطلوب";
        if (string.IsNullOrWhiteSpace(dto.PropertyType))
            errors["propertyType"] = "نوع العقار مطلوب";

        if (!string.IsNullOrWhiteSpace(dto.RestrictionsPresent))
        {
            var r = dto.RestrictionsPresent.Trim().ToLowerInvariant();
            if (r is not "yes" and not "no")
                errors["restrictionsPresent"] = "قيمة القيود غير صالحة";
        }

        if (!string.IsNullOrWhiteSpace(dto.BoundariesAvailability))
        {
            var b = dto.BoundariesAvailability.Trim().ToLowerInvariant();
            if (b is not "deed" and not "bourse" and not "doc" and not "no")
                errors["boundariesAvailability"] = "قيمة توفر الحدود غير صالحة";
        }

        return errors;
    }

    private static void ValidateContacts(WorkOrderPropertyDto dto, Dictionary<string, string> errors)
    {
        var hasContact = false;
        for (var i = 0; i < dto.Contacts.Count; i++)
        {
            var c = dto.Contacts[i];
            var phone = c.Phone.Trim();
            var role = c.Role.Trim();
            if (string.IsNullOrEmpty(phone) && string.IsNullOrEmpty(role))
                continue;
            if (string.IsNullOrEmpty(phone))
                errors[$"contact_phone_{i}"] = "رقم الجوال مطلوب";
            else if (CountPhoneDigits(phone) < 10)
                errors[$"contact_phone_{i}"] = "رقم الجوال يجب أن يكون 10 أرقام على الأقل";
            if (string.IsNullOrEmpty(role))
                errors[$"contact_role_{i}"] = "صفة الضابط مطلوبة";
            if (CountPhoneDigits(phone) >= 10 && !string.IsNullOrEmpty(role))
                hasContact = true;
        }
        if (!hasContact)
            errors["_contacts"] = "أضف ضابط اتصال واحداً على الأقل (جوال + صفة)";
    }

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
