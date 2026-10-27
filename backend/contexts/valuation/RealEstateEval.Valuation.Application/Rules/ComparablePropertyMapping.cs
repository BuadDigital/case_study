// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • A comparable fed from a completed valuation is labelled «تقييم سابق معتمد (ليس صفقة)»
//         (PriorValuationKindLabelAr) — an appraisal, never «صفقة منفّذة».
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Rules;

public static class ComparablePropertyMapping
{
    public const string PriorValuationKindLabelAr = "تقييم سابق معتمد (ليس صفقة)";

    public static ComparablePropertyDto ToDto(
        ComparableProperty row,
        DateOnly today,
        string? anomalyNoteAr = null,
        bool duplicateSuspect = false)
    {
        var fromPrior = !string.IsNullOrWhiteSpace(row.SourceWorkOrderNumber)
            || row.SourcePropertyId is not null
            || row.Source == ComparableSources.PriorValuation;

        return new ComparablePropertyDto
        {
            Id = row.Id,
            ReferenceCode = row.ReferenceCode,
            ComparablePropertyType = row.ComparablePropertyType,
            Usage = row.Usage,
            TransactionKind = row.TransactionKind,
            // A completed valuation fed into the bank is an appraisal, not a sale — never «صفقة منفّذة».
            TransactionKindLabelAr = row.Source == ComparableSources.PriorValuation
                ? PriorValuationKindLabelAr
                : row.TransactionKind == ComparableTransactionKinds.Offer
                    && row.PriceDescription == ComparablePriceDescriptions.Som
                        ? "سوم"
                        : ComparableTransactionKinds.LabelAr(row.TransactionKind),
            PriceDescription = row.PriceDescription ?? "",
            PriceDescriptionLabelAr = ComparablePriceDescriptions.LabelAr(row.PriceDescription),
            Source = row.Source,
            ListingNumber = row.ListingNumber,
            TransactionReference = row.TransactionReference,
            AdvertiserPhone = row.AdvertiserPhone,
            ListingImageFileName = row.ListingImageFileName,
            Latitude = row.Latitude,
            Longitude = row.Longitude,
            AreaSqm = row.AreaSqm,
            TransactionDate = row.TransactionDate.ToString("yyyy-MM-dd"),
            Price = row.Price,
            PricePerSqm = row.PricePerSqm,
            PricePerSqmAnomalyNoteAr = anomalyNoteAr,
            City = row.City,
            District = row.District,
            PlanNumber = row.PlanNumber,
            PlotNumber = row.PlotNumber,
            Description = row.Description,
            IntakeChannel = row.IntakeChannel,
            EnteredByUserId = row.EnteredByUserId,
            EnteredAtUtc = row.EnteredAtUtc.ToString("o"),
            SourceWorkOrderNumber = row.SourceWorkOrderNumber,
            SourcePropertyId = row.SourcePropertyId,
            IsActive = row.IsActive,
            ReliabilityTag = row.ReliabilityTag,
            ReliabilityTagLabelAr = ComparableReliabilityTags.LabelAr(row.ReliabilityTag),
            IsDuplicateTagged = row.IsDuplicateTagged,
            TagRationale = row.TagRationale,
            TaggedByUserId = row.TaggedByUserId,
            TaggedAtUtc = row.TaggedAtUtc?.ToString("o"),
            IsExcludedFromSuggestions = row.IsExcludedFromSuggestions,
            DuplicateSuspect = duplicateSuspect,
            CreatedAtUtc = row.CreatedAtUtc.ToString("o"),
            UpdatedAtUtc = row.UpdatedAtUtc.ToString("o"),
            SourceCard = new ComparableSourceCardDto
            {
                IntakeChannel = row.IntakeChannel,
                IntakeChannelLabelAr = ComparableIntakeChannels.LabelAr(row.IntakeChannel),
                Freshness = ComparablePropertyRules.FreshnessKey(row.TransactionDate, today),
                FreshnessLabelAr = ComparablePropertyRules.FreshnessLabelAr(
                    row.TransactionDate,
                    today),
                FromPriorDeal = fromPrior,
                SourceWorkOrderNumber = row.SourceWorkOrderNumber,
            },
        };
    }
}
