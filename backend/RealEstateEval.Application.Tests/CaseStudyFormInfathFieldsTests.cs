using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class CaseStudyFormInfathFieldsTests
{
    [Fact]
    public async Task Save_persists_infath_specialist_fields()
    {
        var taskId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        await using var db = CreateDb();

        var forms = CreateFormService(db);
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

    private static CaseStudyFormService CreateFormService(ApplicationDbContext db)
    {
        var timeline = new PropertyTimelineService(db);
        var valuation = new ValuationRequestService(
            db,
            new OutboxIntegrationEventPublisher(db, NullLogger<OutboxIntegrationEventPublisher>.Instance));
        var dispatch = new CaseStudyValuationDispatchService(
            db,
            valuation,
            timeline,
            NullLogger<CaseStudyValuationDispatchService>.Instance);
        var fees = TestInspectorFeeServiceFactory.Create(db);
        var workflow = new WorkflowTaskService(db, fees, timeline);
        return new CaseStudyFormService(db, dispatch, workflow);
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"case-study-infath-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }
}
