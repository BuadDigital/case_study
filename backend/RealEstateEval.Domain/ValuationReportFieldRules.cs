namespace RealEstateEval.Domain;

/// <summary>Coverage helpers for valuation-report field payloads.</summary>
public static class ValuationReportFieldRules
{
    public static bool IsResolvableNow(ValuationReportFieldSourceKind kind) =>
        kind is ValuationReportFieldSourceKind.Platform
            or ValuationReportFieldSourceKind.Computed
            or ValuationReportFieldSourceKind.ConditionalEmpty;

    public static bool CountsAsFilled(string? value) =>
        !string.IsNullOrWhiteSpace(value);

    public static string SourceKindApi(ValuationReportFieldSourceKind kind) => kind switch
    {
        ValuationReportFieldSourceKind.Platform => "platform",
        ValuationReportFieldSourceKind.Computed => "computed",
        ValuationReportFieldSourceKind.Deferred => "deferred",
        ValuationReportFieldSourceKind.Asset => "asset",
        ValuationReportFieldSourceKind.ConditionalEmpty => "conditional_empty",
        _ => "deferred",
    };
}
