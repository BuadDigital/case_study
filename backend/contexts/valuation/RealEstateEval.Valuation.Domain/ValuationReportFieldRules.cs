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

    public static string ValueTypeApi(ValuationReportFieldValueType type) => type switch
    {
        ValuationReportFieldValueType.Number => "number",
        ValuationReportFieldValueType.Date => "date",
        ValuationReportFieldValueType.Money => "money",
        ValuationReportFieldValueType.Percent => "percent",
        ValuationReportFieldValueType.Attachment => "attachment",
        _ => "text",
    };

    public static string ValueTypeLabelAr(ValuationReportFieldValueType type) => type switch
    {
        ValuationReportFieldValueType.Number => "رقم",
        ValuationReportFieldValueType.Date => "تاريخ",
        ValuationReportFieldValueType.Money => "مبلغ",
        ValuationReportFieldValueType.Percent => "نسبة",
        ValuationReportFieldValueType.Attachment => "مرفق",
        _ => "نص",
    };
}
