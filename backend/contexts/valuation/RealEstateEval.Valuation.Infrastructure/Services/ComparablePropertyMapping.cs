using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

internal static class ComparablePropertyMapping
{
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
            TransactionKindLabelAr = ComparableTransactionKinds.LabelAr(row.TransactionKind),
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
