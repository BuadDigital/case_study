using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

public class CaseStudyCommandsTests
{
    [Fact]
    public async Task Allocate_document_reference_increments_in_memory()
    {
        await using var db = CreateDb();
        var commands = new CaseStudyCommands(db, TimeProvider.System);

        var first = await commands.AllocateDocumentReferenceAsync("FN", "CS", "260818");
        var second = await commands.AllocateDocumentReferenceAsync("FN", "CS", "260818");

        Assert.Null(first.Error);
        Assert.Equal("FN-CS-260818-001", first.Reference);
        Assert.Equal("FN-CS-260818-002", second.Reference);
    }

    [Fact]
    public async Task Backfill_property_area_writes_only_when_empty()
    {
        await using var db = CreateDb();
        var property = new WorkOrderProperty
        {
            Id = Guid.NewGuid(),
            WorkOrderId = Guid.NewGuid(),
            IdentifierType = PropertyIdentifierType.Deed,
            DeedNumber = "DEED-AREA",
        };
        db.WorkOrderProperties.Add(property);
        await db.SaveChangesAsync();

        var commands = new CaseStudyCommands(db, TimeProvider.System);
        await commands.BackfillPropertyAreaIfEmptyAsync(property.Id, 85.5m);
        await db.Entry(property).ReloadAsync();
        Assert.True(EngineeringSurveyFeeRules.TryParseAreaM2(property.Area, out var first));
        Assert.Equal(85.5m, first);

        await commands.BackfillPropertyAreaIfEmptyAsync(property.Id, 10m);
        await db.Entry(property).ReloadAsync();
        Assert.True(EngineeringSurveyFeeRules.TryParseAreaM2(property.Area, out var second));
        Assert.Equal(85.5m, second);
    }

    private static CaseStudyDbContext CreateDb()
    {
        var name = $"case-study-commands-{Guid.NewGuid():N}";
        return new CaseStudyDbContext(
            new DbContextOptionsBuilder<CaseStudyDbContext>()
                .UseInMemoryDatabase(name, new InMemoryDatabaseRoot())
                .Options);
    }
}
