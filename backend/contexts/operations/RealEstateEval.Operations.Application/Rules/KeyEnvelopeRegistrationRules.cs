using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Operations.Application.Rules;

/// <summary>
/// Pure request checks for key-envelope commands: required fields per receive scenario,
/// which attachments must exist (and the message when one is missing), duplicate-deed
/// detection, and handoff kind / initial status. Attachment existence lookups and
/// persistence stay in <c>KeyEnvelopesService</c>.
/// </summary>
public static class KeyEnvelopeRegistrationRules
{
    public static bool HasAttachment(Guid? id) => id is { } value && value != Guid.Empty;

    public static Guid? EmptyToNull(Guid? id) =>
        id is null || id == Guid.Empty ? null : id;

    /// <summary>Field / scenario validation for registration; null when the request is acceptable.</summary>
    public static string? ValidateRegistration(CreateKeyEnvelopeRequest request, string scenario)
    {
        if (request.RequestNumber.Trim().Length == 0) return "رقم الطلب مطلوب";
        if (request.Court.Trim().Length == 0) return "المحكمة مطلوبة";
        if (request.Circuit.Trim().Length == 0) return "الدائرة مطلوبة";

        if (scenario == KeyReceiveScenarios.Court)
        {
            if (request.KeysCountActual < 1)
                return "عدد المفاتيح الفعلي يجب أن يكون 1 على الأقل";
            if (!HasAttachment(request.PhotoAttachmentId))
                return "صورة الظرف مطلوبة";
            if (!HasAttachment(request.ReceiptAttachmentId))
                return "خطاب الاستلام مطلوب";
        }
        else if (scenario == KeyReceiveScenarios.Missing)
        {
            if (string.IsNullOrWhiteSpace(request.ContactPhones))
                return "أرقام التواصل مطلوبة عندما تكون المفاتيح غير موجودة";
        }
        else if (scenario == KeyReceiveScenarios.ThirdParty)
        {
            if (string.IsNullOrWhiteSpace(request.ContactPhones))
                return "بيانات الطرف المسلِّم مطلوبة";
            if (!HasAttachment(request.ThirdPartyLetterAttachmentId))
                return "خطاب حامل المفتاح مطلوب";
        }

        return null;
    }

    /// <summary>
    /// Attachments the registration references, in verification order, each paired with the
    /// message returned when the file does not exist.
    /// </summary>
    public static IReadOnlyList<(Guid Id, string MissingError)> AttachmentsToVerify(
        CreateKeyEnvelopeRequest request)
    {
        var list = new List<(Guid Id, string MissingError)>();
        if (request.ReceiptAttachmentId is { } rid && rid != Guid.Empty)
            list.Add((rid, "ملف خطاب الاستلام غير موجود"));
        if (request.PhotoAttachmentId is { } pid && pid != Guid.Empty)
            list.Add((pid, "ملف صورة الظرف غير موجود"));
        if (request.ThirdPartyLetterAttachmentId is { } tid && tid != Guid.Empty)
            list.Add((tid, "ملف خطاب الطرف الثالث غير موجود"));
        return list;
    }

    public static bool IsDeedAlreadyAssigned(KeyEnvelope entity, string deed) =>
        entity.Assignments.Any(a =>
            DeedNumberRules.EqualsNormalized(a.DeedNumber, deed));

    public static bool IsKnownHandoffKind(string kind) =>
        kind is KeyHandoffKinds.Internal
            or KeyHandoffKinds.External
            or KeyHandoffKinds.ReceiveBack
            or KeyHandoffKinds.ReturnCourt;

    /// <summary>HTML parity: only external delivery requires a proof letter.</summary>
    public static bool NeedsDeliveryLetter(string kind) => kind == KeyHandoffKinds.External;

    /// <summary>
    /// The receiver confirms (decision 2026-10-20): an internal handoff waits for the inspector; a
    /// receive-back recorded by someone other than the reviewer waits for the reviewer; one the
    /// reviewer records himself is his own confirmation. External and court deliveries complete
    /// at once — the letter is the confirmation.
    /// </summary>
    public static string InitialHandoffStatus(string kind, bool actorIsReceiver = false) =>
        kind switch
        {
            KeyHandoffKinds.Internal => KeyHandoffStatuses.PendingConfirm,
            KeyHandoffKinds.ReceiveBack => actorIsReceiver
                ? KeyHandoffStatuses.Completed
                : KeyHandoffStatuses.PendingConfirm,
            _ => KeyHandoffStatuses.Completed,
        };

    public static bool AwaitsReceiverConfirmation(string kind) =>
        kind is KeyHandoffKinds.Internal or KeyHandoffKinds.ReceiveBack;

    public static string? ValidateHandoffConfirmation(KeyEnvelopeHandoff handoff)
    {
        if (!AwaitsReceiverConfirmation(handoff.Kind))
            return "التأكيد مطلوب للتسليم الداخلي والاسترجاع فقط";
        if (handoff.Status != KeyHandoffStatuses.PendingConfirm)
            return "المناولة مؤكدة مسبقاً";
        return null;
    }

    /// <summary>Key-location fields of a trial result; null when acceptable.</summary>
    public static string? ValidateKeyLocation(string? location)
    {
        var value = (location ?? "").Trim().ToLowerInvariant();
        if (value.Length == 0) return null;
        return KeyLocations.IsValid(value) ? null : "مكان المفتاح غير صالح";
    }
}
