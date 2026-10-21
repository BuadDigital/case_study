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

        var contactId = Guid.NewGuid();
        await using (var db = new CaseStudyDbContext(options))
        {
            db.PropertyContacts.Add(new PropertyContact { Id = contactId, PropertyId = Guid.NewGuid(), Name = "أ" });
            await db.SaveChangesAsync();
        }

        await using (var db = new CaseStudyDbContext(options))
        {
            var contact = await db.PropertyContacts.SingleAsync(c => c.Id == contactId);
            Assert.Equal(new DateTime(2026, 9, 6, 10, 0, 0, DateTimeKind.Utc), contact.UpdatedAtUtc);

            clock.Advance(TimeSpan.FromMinutes(5));
            contact.Name = "ب";
            await db.SaveChangesAsync();
            Assert.Equal(new DateTime(2026, 9, 6, 10, 5, 0, DateTimeKind.Utc), contact.UpdatedAtUtc);
        }
    }

    private sealed class FakeTimeProvider(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan by) => _now = _now.Add(by);
    }
}
