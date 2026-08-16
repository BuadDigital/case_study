using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Builds the Phase-1 contexts over one in-memory store, the way they run over one physical
/// database. Sharing an explicit <see cref="InMemoryDatabaseRoot"/> is what lets a test write
/// through an owner context and still read the row through the legacy context, which is
/// exactly the arrangement the split relies on until owner APIs replace them.
/// </summary>
internal static class TestDatabases
{
 /// <summary>The legacy context plus every extracted context, all over the same store.</summary>
    internal sealed class ContextSet : IAsyncDisposable
    {
        private readonly InMemoryDatabaseRoot _root = new();
        private readonly string _name;

        public ContextSet(string name)
        {
            _name = name;
            Legacy = Create<ApplicationDbContext>(options => new ApplicationDbContext(options));
            Attachments = Create<AttachmentsDbContext>(options => new AttachmentsDbContext(options));
            Platform = Create<PlatformDbContext>(options => new PlatformDbContext(options));
            Valuation = Create<ValuationDbContext>(options => new ValuationDbContext(options));
            CaseStudy = Create<CaseStudyDbContext>(options => new CaseStudyDbContext(options));
        }

        public ApplicationDbContext Legacy { get; }
        public AttachmentsDbContext Attachments { get; }
        public PlatformDbContext Platform { get; }
        public ValuationDbContext Valuation { get; }
        public CaseStudyDbContext CaseStudy { get; }

        public async ValueTask DisposeAsync()
        {
            await CaseStudy.DisposeAsync();
            await Valuation.DisposeAsync();
            await Platform.DisposeAsync();
            await Attachments.DisposeAsync();
            await Legacy.DisposeAsync();
        }

        private TContext Create<TContext>(Func<DbContextOptions<TContext>, TContext> create)
            where TContext : DbContext =>
            create(new DbContextOptionsBuilder<TContext>()
                .UseInMemoryDatabase(_name, _root)
                .Options);
    }

    public static ContextSet Create(string prefix) => new($"{prefix}-{Guid.NewGuid():N}");

    public static ApplicationDbContext Legacy(string prefix) => Create(prefix).Legacy;

    public static AttachmentsDbContext Attachments(string prefix) => Create(prefix).Attachments;

    public static PlatformDbContext Platform(string prefix) => Create(prefix).Platform;

    public static ValuationDbContext Valuation(string prefix) => Create(prefix).Valuation;

    public static CaseStudyDbContext CaseStudy(string prefix) => Create(prefix).CaseStudy;
}
