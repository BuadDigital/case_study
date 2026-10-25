using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ComparablePropertyMappingTests
{
    private static ComparableProperty Row(string source, string kind) => new()
    {
        Id = Guid.NewGuid(),
        ReferenceCode = "CMP-TEST0001",
        TransactionKind = kind,
        Source = source,
        AreaSqm = 500m,
        Price = 1_000_000m,
        PricePerSqm = 2_000m,
        TransactionDate = new DateOnly(2026, 6, 1),
    };

    [Fact]
    public void A_prior_valuation_is_labelled_an_appraisal_not_an_executed_sale()
    {
        var dto = ComparablePropertyMapping.ToDto(
            Row(ComparableSources.PriorValuation, ComparableTransactionKinds.Executed), new DateOnly(2026, 10, 25));

        Assert.Equal(ComparablePropertyMapping.PriorValuationKindLabelAr, dto.TransactionKindLabelAr);
        Assert.DoesNotContain("صفقة منفّذة", dto.TransactionKindLabelAr);
    }

    [Fact]
    public void A_real_executed_deal_keeps_its_label()
    {
        var dto = ComparablePropertyMapping.ToDto(
            Row(ComparableSources.Bourse, ComparableTransactionKinds.Executed), new DateOnly(2026, 10, 25));

        Assert.Equal("صفقة منفّذة", dto.TransactionKindLabelAr);
    }
}
