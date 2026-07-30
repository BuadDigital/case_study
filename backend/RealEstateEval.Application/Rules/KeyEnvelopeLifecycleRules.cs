using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Key-envelope status / scenario / timeline label helpers.
/// </summary>
public static class KeyEnvelopeLifecycleRules
{
    public static void ApplyHandoffStatus(KeyEnvelope entity, string kind)
    {
        entity.Status = kind switch
        {
            KeyHandoffKinds.Internal => KeyEnvelopeStatuses.Assessor,
            KeyHandoffKinds.External => KeyEnvelopeStatuses.External,
            KeyHandoffKinds.ReceiveBack => KeyEnvelopeStatuses.Reviewer,
            KeyHandoffKinds.ReturnCourt => KeyEnvelopeStatuses.Returned,
            _ => entity.Status,
        };
    }

    public static string NormalizeScenario(string? value)
    {
        var s = (value ?? KeyReceiveScenarios.Court).Trim().ToLowerInvariant();
        return s is KeyReceiveScenarios.Missing or KeyReceiveScenarios.ThirdParty
            ? s
            : KeyReceiveScenarios.Court;
    }

    public static string ScenarioCreatedSummary(string scenario) => scenario switch
    {
        KeyReceiveScenarios.Missing => "تسجيل ظرف — المفاتيح غير موجودة (سيناريو ب)",
        KeyReceiveScenarios.ThirdParty => "تسجيل ظرف — مفاتيح عند طرف آخر (سيناريو ج)",
        _ => "تسجيل ظرف مفاتيح من المحكمة (سيناريو أ)",
    };

    public static string AssignmentResultTimelineLabel(string status) => status switch
    {
        KeyAssignmentStatuses.Matched => "مطابق",
        KeyAssignmentStatuses.Partial => "مطابقة جزئية",
        KeyAssignmentStatuses.Unmatched => "غير مطابق",
        KeyAssignmentStatuses.UnmatchedInspected => "غير مطابق — تمت المعاينة",
        KeyAssignmentStatuses.Missing => "مفقود",
        _ => status,
    };

    public static string HandoffSummary(string kind, string from, string to) => kind switch
    {
        KeyHandoffKinds.Internal => $"تسليم داخلي: {from} → {to}",
        KeyHandoffKinds.External => $"تسليم خارجي: {from} → {to}",
        KeyHandoffKinds.ReceiveBack => $"استلام من طرف: {from} → {to}",
        KeyHandoffKinds.ReturnCourt => $"إرجاع للمحكمة: {from} → {to}",
        _ => $"مناولة: {from} → {to}",
    };
}
