using System.Globalization;
using RealEstateEval.Valuation.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Same table as apps/mfe-evaluator/src/lib/evaluator/__tests__/arabic-amount-words.test.ts —
/// both implementations print the report's «فقط … لا غير» line, so they must agree word for word.
/// </summary>
public class ArabicAmountWordsGrammarTests
{
    [Theory]
    [InlineData("1", "ريال سعودي واحد")]
    [InlineData("2", "ريالان سعوديان")]
    [InlineData("3", "ثلاثة ريالات سعودية")]
    [InlineData("10", "عشرة ريالات سعودية")]
    [InlineData("11", "أحد عشر ريالًا سعوديًا")]
    [InlineData("12", "اثنا عشر ريالًا سعوديًا")]
    [InlineData("21", "واحد وعشرون ريالًا سعوديًا")]
    [InlineData("99", "تسعة وتسعون ريالًا سعوديًا")]
    [InlineData("100", "مائة ريال سعودي")]
    [InlineData("101", "مائة ريال سعودي وريال واحد")]
    [InlineData("102", "مائة ريال سعودي وريالان")]
    [InlineData("103", "مائة وثلاثة ريالات سعودية")]
    [InlineData("200", "مائتا ريال سعودي")]
    [InlineData("250", "مائتان وخمسون ريالًا سعوديًا")]
    [InlineData("1000", "ألف ريال سعودي")]
    [InlineData("1001", "ألف ريال سعودي وريال واحد")]
    [InlineData("1250", "ألف ومائتان وخمسون ريالًا سعوديًا")]
    [InlineData("2000", "ألفا ريال سعودي")]
    [InlineData("2500", "ألفان وخمسمائة ريال سعودي")]
    [InlineData("3000", "ثلاثة آلاف ريال سعودي")]
    [InlineData("10000", "عشرة آلاف ريال سعودي")]
    [InlineData("11000", "أحد عشر ألف ريال سعودي")]
    [InlineData("15500", "خمسة عشر ألفًا وخمسمائة ريال سعودي")]
    [InlineData("100000", "مائة ألف ريال سعودي")]
    [InlineData("101000", "مائة ألف وألف ريال سعودي")]
    [InlineData("102000", "مائة ألف وألفا ريال سعودي")]
    [InlineData("103000", "مائة وثلاثة آلاف ريال سعودي")]
    [InlineData("150000", "مائة وخمسون ألف ريال سعودي")]
    [InlineData("200000", "مائتا ألف ريال سعودي")]
    [InlineData("250000", "مائتان وخمسون ألف ريال سعودي")]
    [InlineData("640274", "ستمائة وأربعون ألفًا ومائتان وأربعة وسبعون ريالًا سعوديًا")]
    [InlineData("1000000", "مليون ريال سعودي")]
    [InlineData("1200000", "مليون ومائتا ألف ريال سعودي")]
    [InlineData("1250000", "مليون ومائتان وخمسون ألف ريال سعودي")]
    [InlineData("2000000", "مليونا ريال سعودي")]
    [InlineData("2200000", "مليونان ومائتا ألف ريال سعودي")]
    [InlineData("2810000", "مليونان وثمانمائة وعشرة آلاف ريال سعودي")]
    [InlineData("2820000", "مليونان وثمانمائة وعشرون ألف ريال سعودي")]
    [InlineData("3460000", "ثلاثة ملايين وأربعمائة وستون ألف ريال سعودي")]
    [InlineData("9220000", "تسعة ملايين ومائتان وعشرون ألف ريال سعودي")]
    [InlineData("12500000", "اثنا عشر مليونًا وخمسمائة ألف ريال سعودي")]
    [InlineData("15000000", "خمسة عشر مليون ريال سعودي")]
    [InlineData("100000000", "مائة مليون ريال سعودي")]
    [InlineData("2000000000", "مليارا ريال سعودي")]
    [InlineData("0.5", "خمسون هللةً")]
    [InlineData("1.01", "ريال سعودي واحد وهللة واحدة")]
    [InlineData("10.03", "عشرة ريالات سعودية وثلاث هللات")]
    [InlineData("1000.11", "ألف ريال سعودي وإحدى عشرة هللةً")]
    [InlineData("1000.12", "ألف ريال سعودي واثنتا عشرة هللةً")]
    [InlineData("1000.25", "ألف ريال سعودي وخمس وعشرون هللةً")]
    [InlineData("1000.02", "ألف ريال سعودي وهللتان")]
    [InlineData("0", "صفر ريال سعودي")]
    public void Amount_reads_with_arabic_number_grammar(string amount, string words)
    {
        var value = decimal.Parse(amount, CultureInfo.InvariantCulture);
        Assert.Equal(words, ArabicAmountWords.AmountToArabicWords(value));
    }

    [Fact]
    public void Report_finals_the_testers_flagged()
    {
        Assert.Equal("مليونا ريال سعودي", ArabicAmountWords.AmountToArabicWords(2_000_000m));
        Assert.Equal("مائتا ألف ريال سعودي", ArabicAmountWords.AmountToArabicWords(200_000m));
        Assert.Equal("مائة وثلاثة آلاف ريال سعودي", ArabicAmountWords.AmountToArabicWords(103_000m));
        Assert.Equal("مليونان وثمانمائة وعشرة آلاف ريال سعودي", ArabicAmountWords.AmountToArabicWords(2_810_000m));
    }

    [Fact]
    public void Negative_and_halala_carry()
    {
        Assert.Equal("سالب ثلاثة آلاف ريال سعودي", ArabicAmountWords.AmountToArabicWords(-3_000m));
        Assert.Equal("ريالان سعوديان", ArabicAmountWords.AmountToArabicWords(1.999m));
    }
}
