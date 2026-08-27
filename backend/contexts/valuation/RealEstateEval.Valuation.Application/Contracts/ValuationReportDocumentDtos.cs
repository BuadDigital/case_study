namespace RealEstateEval.Valuation.Application.Contracts;

public class ValuationReportSectionDto
{
    public int Number { get; init; }
    public required string Key { get; init; }
    public required string TitleAr { get; init; }
    public required string BodyKind { get; init; }
    public bool Included { get; init; }
 /// <summary>Short scaffold body for preview — not the final letterhead HTML.</summary>
    public string? PreviewText { get; init; }
    public IReadOnlyDictionary<string, string?> Fields { get; init; } =
        new Dictionary<string, string?>();
}

public class ValuationReportComparableRowDto
{
    public int Index { get; init; }
    public string ComparablePropertyType { get; init; } = "";
    public string TransactionCell { get; init; } = "";
    public string AreaSqmDisplay { get; init; } = "";
    public string TransactionDateDisplay { get; init; } = "";
    public string PriceDisplay { get; init; } = "";
    public string PricePerSqmDisplay { get; init; } = "";
}

public class ValuationReportAdjustmentRowDto
{
    public int Index { get; init; }
    public string ComparableLabel { get; init; } = "";
    public string SequentialPctDisplay { get; init; } = "";
    public string DifferencePctDisplay { get; init; } = "";
    public string WeightPctDisplay { get; init; } = "";
    public string AdjustedPricePerSqmDisplay { get; init; } = "";
}

public class ValuationReportReconMethodRowDto
{
    public string LabelAr { get; init; } = "";
    public string ApproachValueDisplay { get; init; } = "";
    public string WeightPctDisplay { get; init; } = "";
    public string ContributionDisplay { get; init; } = "";
}

public class ValuationReportPrintedAttachmentDto
{
    public Guid AttachmentId { get; init; }
 /// <summary>Relative API URL — /api/attachments/{id}.</summary>
    public string ContentUrl { get; init; } = "";
    public string ContentType { get; init; } = "";
    public string DictionaryTypeKey { get; init; } = "";
    public string LabelAr { get; init; } = "";
    public string FileName { get; init; } = "";
    public int ReportSectionNumber { get; init; }
    public bool IsImage { get; init; }
 /// <summary>Inspector capture date (11س — photos auto-dated), YYYY/MM/DD.</summary>
    public string? CapturedAtDisplay { get; init; }
}

public class ValuationReportDocumentDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
    public string DisplayId { get; init; } = "";
    public bool HasStructuresToValue { get; init; }
    public bool MarketApproachUsed { get; init; }
    public bool CostApproachUsed { get; init; }
    public bool IncomeApproachUsed { get; init; }
    public string? ReportNumber { get; init; }
    public string ReportDateDisplay { get; init; } = "";
 /// <summary>90-day validity end (advisory, never blocking).</summary>
    public string? ValidUntilDisplay { get; init; }
    public string? ValidityNoteAr { get; init; }
    public string PhotoBudgetHintAr { get; init; } = "";
    public string ValuerWordPlain { get; init; } = "المقيم";
    public decimal? FinalOpinionValue { get; init; }
    public string? FinalOpinionDisplay { get; init; }
    public string? FinalOpinionTafqit { get; init; }
    public string? WeightedValueDisplay { get; init; }
    public string? MethodsRationale { get; init; }
    public bool AllowsIssuance { get; init; }
    public string TextLayerNoteAr { get; init; } = "النصوص المعيارية/القانونية تُجمَّد برقم نسخة عند الإصدار — القالب البصري النهائي يعتمد report-template-approved.html عند توفره.";
 /// <summary>Public URL of the approved letterhead HTML (shell static asset).</summary>
    public string ApprovedTemplateUrl { get; init; } = "/ejadah/report-template-approved.html";
 /// <summary>Org-settings letterhead (3-slice render); null keeps the template's baked one.</summary>
    public string? LetterheadImageUrl { get; init; }
    public decimal? LetterheadHeadMm { get; init; }
    public decimal? LetterheadFootTopMm { get; init; }
    public decimal? LetterheadPadMm { get; init; }
    public decimal? LetterheadPadStartMm { get; init; }
    public decimal? StampWidthCm { get; init; }
    public decimal? StampHeightCm { get; init; }
    public string ReportDateHijriDisplay { get; init; } = "";
    public string MarketMethodLabelAr { get; init; } = "غير مستخدم";
    public string CostMethodLabelAr { get; init; } = "غير مستخدم";
    public string IncomeMethodLabelAr { get; init; } = "غير مستخدم";
    public string? WeightedPricePerSqmDisplay { get; init; }
    public string? MarketOpinionDisplay { get; init; }
    public string? SubjectAreaSqmDisplay { get; init; }
    public string? LandValueFromMarketDisplay { get; init; }
    public string? CostOpinionWithLandDisplay { get; init; }
    public string? CostOpinionBuildingsOnlyDisplay { get; init; }
    public IReadOnlyList<ValuationReportComparableRowDto> Comparables { get; init; } = [];
    public IReadOnlyList<ValuationReportAdjustmentRowDto> Adjustments { get; init; } = [];
    public IReadOnlyList<ValuationReportReconMethodRowDto> ReconciliationMethods { get; init; } = [];
    public IReadOnlyList<ValuationReportPrintedAttachmentDto> SiteMapAttachments { get; init; } = [];
    public IReadOnlyList<ValuationReportPrintedAttachmentDto> PhotoAttachments { get; init; } = [];
    public IReadOnlyList<ValuationReportPrintedAttachmentDto> SurveyAttachments { get; init; } = [];
    public IReadOnlyList<ValuationReportPrintedAttachmentDto> DeedAttachments { get; init; } = [];
    public IReadOnlyList<ValuationReportSectionDto> Sections { get; init; } = [];
}