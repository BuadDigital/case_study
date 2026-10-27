// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Alerts New file — SaveValuationAlertOverridesRequest: the methodology-alert dispositions saved on their
//           own, so an acknowledgement never waits on «مبرر استخدام طرق التقييم»; codes not sent are kept.
// Round 2 (1b19bedc)
//  • R2-10 MethodologyAlertOverrides is [Required] with an Arabic message «قائمة معالجات التنبيهات مطلوبة.».
// ──────────────────────────────────────────────────────────────────────────────────────────────

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>
/// The methodology-alert dispositions (rationale / acknowledgement) saved on their own — without the
/// rest of the reconciliation, so an acknowledgement never waits on «مبرر استخدام طرق التقييم».
/// Codes sent replace the stored disposition of that code; codes not sent are kept.
/// </summary>
public class SaveValuationAlertOverridesRequest
{
    [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "قائمة معالجات التنبيهات مطلوبة.")]
    public IReadOnlyList<ValuationMethodologyAlertOverrideDto> MethodologyAlertOverrides { get; init; } = [];
}
