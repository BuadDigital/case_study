using RealEstateEval.Valuation.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class DepositCodeFormatTests
{
    [Theory]
    [InlineData("-")]
    [InlineData("--/--")]
    [InlineData("A-1")]
    [InlineData("   ")]
    public void A_code_without_enough_letters_or_digits_is_refused(string code) =>
        Assert.Equal(DepositCertificateRules.CodeMalformedAr, DepositCertificateRules.CodeFormatError(code));

    [Theory]
    [InlineData("QM-2026-AZ005")]
    [InlineData("QYM-1")]
    [InlineData("١٢٣٤")]
    public void A_real_looking_code_passes(string code) =>
        Assert.Null(DepositCertificateRules.CodeFormatError(code));
}
