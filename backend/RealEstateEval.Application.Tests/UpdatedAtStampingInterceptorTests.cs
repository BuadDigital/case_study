using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

public class UpdatedAtStampingInterceptorTests
{
    [Fact]
    public async Task Stamps_updated_at_on_insert_and_on_every_later_change()
    {
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 9, 6, 10, 0, 0, TimeSpan.Zero));
        var options = new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"updated-at-{Guid.NewGuid()}")
            .AddInterceptors(new UpdatedAtStampingInterceptor(clock))
            .Options;

        var groupId = Guid.NewGuid();
        await using (var db = new CaseStudyDbContext(options))
        {
            db.PropertyGroups.Add(new PropertyGroup { Id = groupId, Name = "أ", CreatedAtUtc = clock.GetUtcNow().UtcDateTime });
            await db.SaveChangesAsync();
        }

        await using (var db = new CaseStudyDbContext(options))
        {
            var group = await db.PropertyGroups.SingleAsync(g => g.Id == groupId);
            Assert.Equal(new DateTime(2026, 9, 6, 10, 0, 0, DateTimeKind.Utc), group.UpdatedAtUtc);

            clock.Advance(TimeSpan.FromMinutes(5));
            group.Name = "ب";
            await db.SaveChangesAsync();
            Assert.Equal(new DateTime(2026, 9, 6, 10, 5, 0, DateTimeKind.Utc), group.UpdatedAtUtc);
        }
    }

    private sealed class FakeTimeProvider(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan by) => _now = _now.Add(by);
    }
}
