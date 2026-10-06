namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Where a report's generated files live in the attachments service. Both scopes are registry types of the
/// property documents («شهادة الإيداع» and «تقرير التقييم», group outputs, PDF only), and the scope key starts
/// with the property id, so the files show in the property's documents tab with every cycle (v1, v2…) kept.
/// </summary>
public static class ReportFileScopes
{
    /// <summary>The Qeema deposit certificate (one-page PDF) of a deposit cycle.</summary>
    public const string DepositCertificate = "evaluator-deposit-certificate";

    /// <summary>The generated final report: the approved report with the deposit code + the certificate page.</summary>
    public const string FinalReport = "evaluator-report";

    /// <summary>{propertyId}:{kind}:v{version} — one key per cycle.</summary>
    public static string Key(Guid propertyId, string kind, int version) =>
        $"{propertyId:D}:{kind}:v{version}";

    /// <summary>The name the file is stored under: the given one when it is a usable PDF name, else the fallback.</summary>
    public static string PdfFileName(string? requested, string fallbackStem)
    {
        var name = (requested ?? "").Trim();
        var slash = name.LastIndexOfAny(['/', (char)92]);
        if (slash >= 0) name = name[(slash + 1)..];
        return name.Length > 0 && name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
            ? name
            : $"{fallbackStem}.pdf";
    }
}
