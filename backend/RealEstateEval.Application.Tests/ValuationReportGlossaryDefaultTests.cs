using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationReportGlossaryDefaultTests
{
    private static string[] Lines(string text) =>
        text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    [Fact]
    public void Default_glossary_is_the_reference_report_glossary_one_term_per_line()
    {
        var lines = Lines(ValuationReportSettingsDefaults.Glossary);

        Assert.Equal(42, lines.Length);
        Assert.All(lines, line =>
        {
            var colon = line.IndexOf(": ", StringComparison.Ordinal);
            Assert.True(colon > 0, $"no «term: definition» split in: {line}");
            Assert.False(string.IsNullOrWhiteSpace(line[(colon + 2)..]));
        });
        Assert.StartsWith("المنشأة: ", lines[0]);
        Assert.StartsWith("طلب العروض: ", lines[^1]);
        Assert.Equal(lines.Length, lines.Select(l => l[..l.IndexOf(": ", StringComparison.Ordinal)]).Distinct().Count());
    }

    [Fact]
    public void A_stored_copy_of_the_previous_default_is_upgraded()
    {
        Assert.Equal(
            ValuationReportSettingsDefaults.Glossary,
            ValuationReportSettingsDefaults.UpgradeGlossary(ValuationReportSettingsDefaults.PreviousGlossary));
    }

    [Fact]
    public void The_upgrade_ignores_line_ending_and_edge_whitespace_differences()
    {
        var stored = "\r\n" + ValuationReportSettingsDefaults.PreviousGlossary.Replace("\n", "\r\n") + "\r\n";

        Assert.Equal(
            ValuationReportSettingsDefaults.Glossary,
            ValuationReportSettingsDefaults.UpgradeGlossary(stored));
    }

    [Theory]
    [InlineData("المنشأة: تعريف الشركة الخاص.")]
    [InlineData("")]
    [InlineData(null)]
    public void An_organisations_own_glossary_is_left_alone(string? stored)
    {
        Assert.Equal(stored, ValuationReportSettingsDefaults.UpgradeGlossary(stored));
    }

    [Fact]
    public void Default_ivs_text_is_the_reference_report_standards_one_per_line()
    {
        var lines = Lines(ValuationReportSettingsDefaults.IvsStandards);

        Assert.Equal(7, lines.Length);
        for (var i = 0; i < lines.Length; i++)
            Assert.StartsWith($"المعيار {100 + i} – ", lines[i]);
        Assert.All(lines, line => Assert.True(line.IndexOf(": ", StringComparison.Ordinal) > 0));
        // The first standard carries its whole list of principles in one line.
        Assert.Contains("مبادئ المُقيّم", lines[0]);
        Assert.Contains("(AVM)", lines[5]);
    }

    [Fact]
    public void A_stored_copy_of_the_previous_ivs_text_is_upgraded_and_own_text_is_kept()
    {
        Assert.Equal(
            ValuationReportSettingsDefaults.IvsStandards,
            ValuationReportSettingsDefaults.UpgradeIvsStandards(ValuationReportSettingsDefaults.PreviousIvsStandards));
        Assert.Equal(
            "نص المؤسسة الخاص",
            ValuationReportSettingsDefaults.UpgradeIvsStandards("نص المؤسسة الخاص"));
    }

    [Fact]
    public void Default_restrictions_are_the_six_clauses_of_the_v3_design()
    {
        var lines = Lines(ValuationReportSettingsDefaults.Restrictions);

        Assert.Equal(6, lines.Length);
        Assert.Contains("{{reportDate}}", lines[4]);
        Assert.StartsWith("تحتفظ الشركة بحقها", lines[4]);
        Assert.EndsWith("بكافة بنوده وملاحقه.", lines[5]);
    }

    [Fact]
    public void Default_terms_are_the_full_clause_list_of_the_v3_design()
    {
        var lines = Lines(ValuationReportSettingsDefaults.Terms);

        Assert.True(lines.Length >= 18, $"only {lines.Length} lines");
        Assert.Contains(lines, l => l == "للمباني والعقارات القائمة:");
        Assert.Contains(lines, l => l.StartsWith("- يتم تقدير تكلفة المباني"));
    }

    [Fact]
    public void Stored_copies_of_the_short_previous_terms_and_restrictions_are_upgraded()
    {
        Assert.Equal(
            ValuationReportSettingsDefaults.Terms,
            ValuationReportSettingsDefaults.UpgradeTerms(ValuationReportSettingsDefaults.PreviousTerms));
        Assert.Equal(
            ValuationReportSettingsDefaults.Restrictions,
            ValuationReportSettingsDefaults.UpgradeRestrictions(ValuationReportSettingsDefaults.PreviousRestrictions));
        Assert.True(Lines(ValuationReportSettingsDefaults.PreviousTerms).Length < 10);
        Assert.Equal(5, Lines(ValuationReportSettingsDefaults.PreviousRestrictions).Length);
    }

    [Theory]
    [InlineData("بند خاص بالمؤسسة.")]
    [InlineData("")]
    [InlineData(null)]
    public void An_organisations_own_terms_and_restrictions_are_left_alone(string? stored)
    {
        Assert.Equal(stored, ValuationReportSettingsDefaults.UpgradeTerms(stored));
        Assert.Equal(stored, ValuationReportSettingsDefaults.UpgradeRestrictions(stored));
    }
}
