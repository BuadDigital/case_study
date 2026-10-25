namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>
/// The methodology-alert dispositions (rationale / acknowledgement) saved on their own — without the
/// rest of the reconciliation, so an acknowledgement never waits on «مبرر استخدام طرق التقييم».
/// Codes sent replace the stored disposition of that code; codes not sent are kept.
/// </summary>
public class SaveValuationAlertOverridesRequest
{
    public IReadOnlyList<ValuationMethodologyAlertOverrideDto> MethodologyAlertOverrides { get; init; } = [];
}
