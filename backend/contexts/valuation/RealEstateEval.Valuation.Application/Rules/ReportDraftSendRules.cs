using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Round 2: the specialist cannot send the valuation-report draft while a required report document
/// that only he uploads is missing (the issuance gate <c>required_attachments</c> — «صك الملكية»,
/// «التقرير المساحي» …). The appraiser's approval issues the deposit copy through the same gate, so a
/// draft sent without them could only be refused for something the appraiser cannot fix.
/// </summary>
public static class ReportDraftSendRules
{
    public const string ErrorKey = "requiredAttachments";

    public const string MissingDocumentsPrefixAr =
        "لا تُرسَل المسودة للمقيّم قبل رفع المستندات الإلزامية التي يرفعها الأخصائي — ";

    /// <summary>The send refusal naming every missing document, or null when none is missing (or no gates).</summary>
    public static Dictionary<string, string>? MissingSpecialistDocumentsError(ValuationIssuanceGatesDto? gates)
    {
        var gate = gates?.Gates.FirstOrDefault(g =>
            g.IsHard
            && !g.Passed
            && string.Equals(g.Code, ValuationIssuanceGateCodes.RequiredAttachments, StringComparison.OrdinalIgnoreCase));
        if (gate is null) return null;
        var detail = string.IsNullOrWhiteSpace(gate.DetailAr) ? gate.LabelAr : gate.DetailAr.Trim();
        return new Dictionary<string, string> { [ErrorKey] = MissingDocumentsPrefixAr + detail };
    }
}
