using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

public class PoIntakeDraftServiceTests
{
    [Fact]
    public async Task Get_returns_an_empty_draft_when_the_user_has_no_row()
    {
        var service = new PoIntakeDraftService(new FakePoIntakeDraftRepository());
        var result = await service.GetForUserAsync("user-1", CancellationToken.None);
        Assert.Equal(1, result.Step);
        Assert.Equal("", result.PoNumber);
        Assert.Null(result.UpdatedAtUtc);
    }

    [Fact]
    public async Task Save_persists_through_the_repository()
    {
        var repo = new FakePoIntakeDraftRepository();
        var clock = new FrozenTimeProvider(new DateTimeOffset(2026, 8, 20, 7, 0, 0, TimeSpan.Zero));
        var service = new PoIntakeDraftService(repo, clock);

        var saved = await service.SaveForUserAsync(
            "user-1",
            new PoIntakeDraftDto { Step = 2, PoNumber = "PO-9", ExpectedPropertyCount = 3 },
            CancellationToken.None);

        Assert.Equal(2, saved.Step);
        Assert.Equal("PO-9", saved.PoNumber);
        Assert.Equal(new DateTime(2026, 8, 20, 7, 0, 0, DateTimeKind.Utc), saved.UpdatedAtUtc);
        Assert.Single(repo.Items);
        Assert.Equal("user-1", repo.Items[0].UserId);
        Assert.Contains("PO-9", repo.Items[0].DraftJson, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Get_returns_an_empty_draft_when_stored_json_is_corrupt()
    {
        var repo = new FakePoIntakeDraftRepository();
        repo.Items.Add(new PoIntakeDraft
        {
            Id = Guid.NewGuid(),
            UserId = "user-1",
            DraftJson = "{not-json",
            UpdatedAtUtc = new DateTime(2026, 8, 20, 8, 0, 0, DateTimeKind.Utc),
        });
        var service = new PoIntakeDraftService(repo);

        var result = await service.GetForUserAsync("user-1", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(1, result!.Step);
        Assert.Equal(1, result.ExpectedPropertyCount);
    }

    [Fact]
    public async Task Delete_removes_the_user_draft()
    {
        var repo = new FakePoIntakeDraftRepository();
        repo.Items.Add(new PoIntakeDraft { Id = Guid.NewGuid(), UserId = "user-1" });
        var service = new PoIntakeDraftService(repo);

        await service.DeleteForUserAsync("user-1", CancellationToken.None);

        Assert.Empty(repo.Items);
    }

    private sealed class FrozenTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class FakePoIntakeDraftRepository : IPoIntakeDraftRepository
    {
        public List<PoIntakeDraft> Items { get; } = [];

        public Task<PoIntakeDraft?> GetByUserIdAsync(
            string userId,
            bool track,
            CancellationToken cancellationToken) =>
            Task.FromResult(Items.FirstOrDefault(x => x.UserId == userId));

        public void Add(PoIntakeDraft draft) => Items.Add(draft);

        public Task DeleteByUserIdAsync(string userId, CancellationToken cancellationToken)
        {
            Items.RemoveAll(x => x.UserId == userId);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
