using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

public class SpecialistReportExtrasRulesTests
{
    [Fact]
    public void Apply_clears_columns_for_null_or_empty()
    {
        var entity = SeededEntity();
        Assert.Null(SpecialistReportExtrasRules.ApplyFromWireJson(entity, "null"));
        Assert.Null(entity.SpecialistFinishingLevel);
        Assert.Null(entity.SearchScopeNotes);
        Assert.Null(entity.PrintAttachmentKeysJson);
        Assert.Null(entity.InfathDepositCode);
        Assert.Null(entity.InfathDepositCertificateName);
        Assert.Null(entity.SpecialistEsgJson);
        Assert.Null(entity.SpecialistReportExtrasJson);
    }

    [Fact]
    public void Apply_promotes_known_bag_fields_onto_columns()
    {
        var entity = new WorkOrderProperty();
        var wire = """
            {
              "finishing": "Luxury",
              "searchScopeNotes": " within 5km ",
              "printKeys": [" deed ", "", "site"],
              "infathDeposit": {
                "depositCode": " DEP-1 ",
                "depositCertificateName": "cert.pdf"
              },
              "esg": { "esgEnv": { "status": "none" } }
            }
            """;

        Assert.Null(SpecialistReportExtrasRules.ApplyFromWireJson(entity, wire));

        Assert.Equal("luxury", entity.SpecialistFinishingLevel);
        Assert.Equal("within 5km", entity.SearchScopeNotes);
        Assert.Contains("deed", entity.PrintAttachmentKeysJson);
        Assert.Contains("site", entity.PrintAttachmentKeysJson);
        Assert.Equal("DEP-1", entity.InfathDepositCode);
        Assert.Equal("cert.pdf", entity.InfathDepositCertificateName);
        Assert.Contains("esgEnv", entity.SpecialistEsgJson);

        var projected = SpecialistReportExtrasRules.ToWireJson(entity);
        Assert.NotNull(projected);
        Assert.Contains("\"finishing\":\"luxury\"", projected.Replace(" ", ""));
        Assert.Contains("searchScopeNotes", projected);
        Assert.Contains("printKeys", projected);
        Assert.Contains("infathDeposit", projected);
        Assert.Contains("esg", projected);
    }

    [Fact]
    public void Apply_drops_finishing_for_inspector_confirmed_land()
    {
        var entity = new WorkOrderProperty
        {
            PropertyType = "فيلا",
            InspectedPropertyType = "أرض",
        };

        Assert.Null(SpecialistReportExtrasRules.ApplyFromWireJson(
            entity,
            """{"finishing":"luxury"}"""));
        Assert.Null(entity.SpecialistFinishingLevel);
        Assert.DoesNotContain(
            "finishing",
            SpecialistReportExtrasRules.ToWireJson(entity) ?? "");
    }

    [Fact]
    public void Apply_rejects_invalid_json()
    {
        var entity = new WorkOrderProperty();
        var errors = SpecialistReportExtrasRules.ApplyFromWireJson(entity, "{not json");
        Assert.Equal("صيغة JSON غير صالحة", errors!["specialistReportExtrasJson"]);
    }

    [Fact]
    public void ToWireJson_falls_back_to_legacy_bag_when_columns_empty()
    {
        var entity = new WorkOrderProperty
        {
            SpecialistReportExtrasJson = """{"finishing":"medium"}""",
        };
        Assert.Equal("""{"finishing":"medium"}""", SpecialistReportExtrasRules.ToWireJson(entity));
    }

    private static WorkOrderProperty SeededEntity() => new()
    {
        SpecialistFinishingLevel = "luxury",
        SearchScopeNotes = "notes",
        PrintAttachmentKeysJson = """["a"]""",
        InfathDepositCode = "c",
        InfathDepositCertificateName = "n",
        SpecialistEsgJson = """{"x":1}""",
        SpecialistReportExtrasJson = """{"finishing":"luxury"}""",
    };
}
