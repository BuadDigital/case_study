using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class PropertyComparableLinkServiceTests
{
    [Fact]
    public async Task ListAsync_returns_only_active_linked_comparables_for_the_property()
    {
        await using var db = CreateDb();
        var propertyId = Guid.NewGuid();
        var active = await SeedComparableAsync(db, active: true);
        var inactive = await SeedComparableAsync(db, active: false);
        var otherProperty = await SeedComparableAsync(db, active: true);
        await LinkAsync(db, propertyId, active, "وصف الربط");
        await LinkAsync(db, propertyId, inactive, null);
        await LinkAsync(db, Guid.NewGuid(), otherProperty, null);

        var list = await new PropertyComparableLinkService(db).ListAsync(propertyId);

        Assert.Equal(propertyId, list.PropertyId);
        Assert.Equal(1, list.LinkedCount);
        var item = Assert.Single(list.Items);
        Assert.Equal(active, item.ComparablePropertyId);
        Assert.Equal("وصف الربط", item.Description);
    }

    private static async Task LinkAsync(
        ValuationDbContext db,
        Guid propertyId,
        Guid comparableId,
        string? description)
    {
        db.PropertyComparableLinks.Add(new PropertyComparableLink
        {
            Id = Guid.NewGuid(),
            PropertyId = propertyId,
            ComparablePropertyId = comparableId,
            Description = description,
            LinkedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static async Task<Guid> SeedComparableAsync(ValuationDbContext db, bool active)
    {
        var id = Guid.NewGuid();
        db.ComparableProperties.Add(new ComparableProperty
        {
            Id = id,
            IsActive = active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
            EnteredAtUtc = DateTime.UtcNow,
            TransactionDate = new DateOnly(2026, 1, 1),
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static ValuationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ValuationDbContext>()
            .UseInMemoryDatabase($"comp-link-{Guid.NewGuid():N}")
            .Options);
}
