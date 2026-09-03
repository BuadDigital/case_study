using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.Application.Tests;

public class ClientServiceTests
{
    [Fact]
    public async Task Create_rejects_missing_arabic_name()
    {
        var service = new ClientService(new FakeClientRepository());
        var (_, errors) = await service.CreateAsync(
            new UpsertClientRequest { NameAr = "  " },
            CancellationToken.None);

        Assert.NotNull(errors);
        Assert.Equal("اسم العميل بالعربية مطلوب", errors!["nameAr"]);
    }

    [Fact]
    public async Task Deactivate_blocks_seed_clients()
    {
        var service = new ClientService(new FakeClientRepository());
        var (ok, error) = await service.DeactivateAsync(
            SeedClientIds.InfathAssignmentCenter,
            CancellationToken.None);

        Assert.False(ok);
        Assert.Equal("لا يمكن تعطيل عميل إنفاذ الأساسي", error);
    }

    [Fact]
    public async Task Create_persists_through_the_repository()
    {
        var repo = new FakeClientRepository();
        var clock = new FrozenTimeProvider(new DateTimeOffset(2026, 8, 20, 6, 0, 0, TimeSpan.Zero));
        var service = new ClientService(repo, clock);

        var (result, errors) = await service.CreateAsync(
            new UpsertClientRequest { NameAr = "عميل تجريبي", IsActive = true },
            CancellationToken.None);

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.Equal("عميل تجريبي", result!.NameAr);
        Assert.Single(repo.Items);
        Assert.Equal(result.Id, repo.Items[0].Id);
    }

    private sealed class FrozenTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class FakeClientRepository : IClientRepository
    {
        public List<Client> Items { get; } = [];

        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(Items.Any(c => c.Id == id));

        public Task<Client?> GetByIdAsync(Guid id, bool track, CancellationToken cancellationToken) =>
            Task.FromResult(Items.FirstOrDefault(c => c.Id == id));

        public Task<IReadOnlyList<Client>> ListAsync(
            bool includeInactive,
            CancellationToken cancellationToken)
        {
            IEnumerable<Client> q = Items;
            if (!includeInactive)
                q = q.Where(c => c.IsActive);
            return Task.FromResult<IReadOnlyList<Client>>(q.OrderBy(c => c.NameAr).ToList());
        }

        public void Add(Client client) => Items.Add(client);

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
