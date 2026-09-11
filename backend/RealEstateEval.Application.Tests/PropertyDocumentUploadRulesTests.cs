using RealEstateEval.Attachments.Application.Rules;
using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class PropertyDocumentUploadRulesTests
{
    private const string Governed = PropertyDocumentTypes.GovernedScope;
    private const string ScopeKey = "PO-1:prop-1";
    private const string Reason = "مستند نادر طلبه العميل للمعاملة";

    [Fact]
    public void Documents_tab_upload_requires_a_document_type()
    {
        var result = PropertyDocumentUploadRules.Resolve(Governed, ScopeKey, null, null, null);

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Documents_tab_upload_rejects_a_type_outside_the_registry()
    {
        var result = PropertyDocumentUploadRules.Resolve(Governed, ScopeKey, "random-paper", null, null);

        Assert.Equal("نوع المستند غير معرّف في النظام", result.Error);
    }

    [Theory]
    [InlineData("survey")]
    [InlineData("site-letter")]
    [InlineData("inspection-photo")]
    [InlineData("valuation-report")]
    public void Documents_tab_upload_rejects_types_owned_by_another_party(string key)
    {
        var result = PropertyDocumentUploadRules.Resolve(Governed, ScopeKey, key, null, null);

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Documents_tab_upload_of_a_defined_type_needs_no_review()
    {
        var result = PropertyDocumentUploadRules.Resolve(Governed, ScopeKey, "Lease-Contract", "ignored", "ignored");

        Assert.Null(result.Error);
        Assert.Equal("lease-contract", result.TypeKey);
        Assert.Null(result.CustomLabel);
        Assert.Null(result.CustomReason);
        Assert.Null(result.ReviewStatus);
    }

    [Theory]
    [InlineData(null, Reason)]
    [InlineData("م", Reason)]
    [InlineData("محضر لجنة", null)]
    [InlineData("محضر لجنة", "قصير")]
    public void Unlisted_document_needs_a_name_and_a_reason(string? label, string? reason)
    {
        var result = PropertyDocumentUploadRules.Resolve(
            Governed, ScopeKey, PropertyDocumentTypes.UnlistedKey, label, reason);

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Unlisted_document_with_name_and_reason_waits_for_review()
    {
        var result = PropertyDocumentUploadRules.Resolve(
            Governed, ScopeKey, PropertyDocumentTypes.UnlistedKey, " محضر لجنة ", Reason);

        Assert.Null(result.Error);
        Assert.Equal(PropertyDocumentTypes.UnlistedKey, result.TypeKey);
        Assert.Equal("محضر لجنة", result.CustomLabel);
        Assert.Equal(PropertyDocumentReviewStatuses.Pending, result.ReviewStatus);
    }

    [Fact]
    public void Other_documents_field_is_unlisted_and_needs_a_reason_too()
    {
        Assert.NotNull(PropertyDocumentUploadRules.Resolve("property-other", ScopeKey, null, null, null).Error);

        var ok = PropertyDocumentUploadRules.Resolve("property-other", ScopeKey, null, "محضر لجنة", Reason);
        Assert.Null(ok.Error);
        Assert.Equal(PropertyDocumentReviewStatuses.Pending, ok.ReviewStatus);
    }

    [Theory]
    [InlineData("property-bourse-deed", null, "bourse-deed")]
    [InlineData("property-decree", null, "assignment-letter")]
    [InlineData("engineering-survey-report", null, "survey")]
    [InlineData("field-inspection-photo", "task-1:feature:facade", "inspection-photo")]
    [InlineData("field-inspection-photo", "task-1:component:buildLicense", "building-permit")]
    public void Field_scopes_are_classified_by_the_field_they_come_from(
        string scope, string? scopeKey, string expected)
    {
        var result = PropertyDocumentUploadRules.Resolve(scope, scopeKey ?? ScopeKey, null, null, null);

        Assert.Null(result.Error);
        Assert.Equal(expected, result.TypeKey);
    }

    [Fact]
    public void Field_scope_rejects_a_contradicting_document_type()
    {
        var result = PropertyDocumentUploadRules.Resolve("property-delegation", ScopeKey, "deed", null, null);

        Assert.Equal("نوع المستند لا يطابق موضع الرفع", result.Error);
    }

    [Fact]
    public void Non_property_scopes_carry_no_document_type()
    {
        Assert.Equal(
            ResolvedDocumentType.None,
            PropertyDocumentUploadRules.Resolve("key-envelope-receipt", "env-1", null, null, null));
        Assert.NotNull(
            PropertyDocumentUploadRules.Resolve("key-envelope-receipt", "env-1", "deed", null, null).Error);
    }

    [Theory]
    [InlineData(PropertyDocumentTypes.GovernedScope)]
    [InlineData("property-other")]
    public void Tab_and_other_documents_can_be_reclassified(string scope)
    {
        var result = PropertyDocumentUploadRules.Reclassify(scope, "owner-identity", null, null);

        Assert.Null(result.Error);
        Assert.Equal("owner-identity", result.TypeKey);
        Assert.Null(result.ReviewStatus);
    }

    [Fact]
    public void Field_bound_documents_keep_their_type()
    {
        var result = PropertyDocumentUploadRules.Reclassify("property-deed-ownership", "lease-contract", null, null);

        Assert.NotNull(result.Error);
    }

    [Fact]
    public void Review_applies_to_unlisted_documents_only()
    {
        Assert.NotNull(PropertyDocumentUploadRules.ValidateReview("deed", "approved", null));
        Assert.Null(PropertyDocumentUploadRules.ValidateReview("unlisted", "approved", null));
    }

    [Fact]
    public void Rejecting_an_unlisted_document_needs_a_note()
    {
        Assert.NotNull(PropertyDocumentUploadRules.ValidateReview("unlisted", "rejected", " "));
        Assert.Null(PropertyDocumentUploadRules.ValidateReview("unlisted", "rejected", "ليس مستندًا للعقار"));
        Assert.NotNull(PropertyDocumentUploadRules.ValidateReview("unlisted", "pending", null));
    }
}
