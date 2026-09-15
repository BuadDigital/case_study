using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side validation for property-appraisal party task payloads —
/// mirrors <c>validateEvaluatorSubmission</c> Infath gates in the MFE.
/// Report participants are derived (fixed roster + assigned appraiser), not a submit field.
/// </summary>
public static class PropertyAppraisalSubmissionValidator
{
    public static Dictionary<string, string> Validate(JsonElement root)
    {
        var errors = new Dictionary<string, string>();

        if (!HasNonEmpty(root, "evaluatorPrice"))
            errors["evaluatorPrice"] = "سعر التقييم مطلوب";

        return errors;
    }

    private static bool HasNonEmpty(JsonElement element, string name) =>
        JsonElementReader.HasNonEmptyString(element, name);
}
