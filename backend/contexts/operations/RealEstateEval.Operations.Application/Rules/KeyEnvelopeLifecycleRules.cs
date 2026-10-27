using RealEstateEval.Domain;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Rules;

/// <summary>
/// Key-envelope status / scenario / timeline label helpers.
/// </summary>
public static class KeyEnvelopeLifecycleRules
{
    public static void ApplyHandoffStatus(KeyEnvelope entity, string kind) =>
        entity.ApplyHandoffKind(kind);

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

    /// <summary>Arabic label of where a deed's matching key is, printed on the envelope timeline.</summary>
    public static string KeyLocationLabel(string? location) => location switch
    {
        KeyLocations.WithUser => "عند مستخدم",
        KeyLocations.ReturnedCourt => "أُعيد للمحكمة",
        KeyLocations.Missing => "مفقود",
        _ => "في الظرف",
    };

    /// <summary>Every deed of ours was tried and every matching key is back in the envelope, returned or lost.</summary>
    /// <remarks>
    /// How it works: true only when 1) the envelope is with the reviewer (status reviewer), 2) it has at
    /// least one assignment, and 3) every assignment has a trial result and no key is with_user. Read by
    /// the mapper into the «ready to go back to court» hint.
    /// Edge cases: an envelope with no deeds is never ready; one pending deed or one key still kept by a
    /// user holds the hint back; a missing / returned key does not.
    /// </remarks>
    public static bool ReadyForCourtReturn(KeyEnvelope envelope) =>
        envelope.Status == KeyEnvelopeStatuses.Reviewer
        && envelope.Assignments.Count > 0
        && envelope.Assignments.All(a =>
            KeyAssignmentStatuses.IsConfirmResult(a.Status)
            && a.KeyLocation != KeyLocations.WithUser);

    public static string HandoffSummary(string kind, string from, string to) => kind switch
    {
        KeyHandoffKinds.Internal => $"تسليم داخلي: {from} → {to}",
        KeyHandoffKinds.External => $"تسليم خارجي: {from} → {to}",
        KeyHandoffKinds.ReceiveBack => $"استلام من طرف: {from} → {to}",
        KeyHandoffKinds.ReturnCourt => $"إرجاع للمحكمة: {from} → {to}",
        _ => $"مناولة: {from} → {to}",
    };
}
