using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.Application.Tests;

public class CaseStudyFormInfathFieldsTests
{
    [Fact]
    public async Task Save_persists_infath_specialist_fields()
    {
        var taskId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        await using var contexts = TestDatabases.Create("case-study-infath");
        var db = contexts.CaseStudy;

        var forms = CreateFormService(contexts);
        var form = new CaseStudyFormDto
        {
            TaskId = taskId.ToString(),
            Status = "draft",
            InfathLinkedAssets = "yes",
            InfathLinkedDeedNumbers = "0011, 0012",
            InfathLinkedAssetsNotes = "ملاحظات ربط",
            InfathOtherNotes = "ملاحظات عامة",
            InfathClosingNotes = "ملاحظات ختامية",
        };

        var (_, errors) = await forms.SaveAsync(taskId, party: false, form);
        Assert.Null(errors);
        var loaded = await forms.GetAsync(taskId, party: false);

        Assert.NotNull(loaded);
        Assert.Equal("yes", loaded.InfathLinkedAssets);
        Assert.Equal("0011, 0012", loaded.InfathLinkedDeedNumbers);
        Assert.Equal("ملاحظات ربط", loaded.InfathLinkedAssetsNotes);
        Assert.Equal("ملاحظات عامة", loaded.InfathOtherNotes);
        Assert.Equal("ملاحظات ختامية", loaded.InfathClosingNotes);

        var entity = await db.CaseStudyForms.SingleAsync();
        Assert.Equal("yes", entity.InfathLinkedAssets);
        Assert.Equal("ملاحظات ختامية", entity.InfathClosingNotes);
    }

    private static CaseStudyFormService CreateFormService(TestDatabases.ContextSet contexts)
    {
        var db = contexts.CaseStudy;
        var workflow = TestInspectorFeeServiceFactory.CreateWorkflow(db);
        return new CaseStudyFormService(db, workflow);
    }
}
