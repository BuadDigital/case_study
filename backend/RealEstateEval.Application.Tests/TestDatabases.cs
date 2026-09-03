using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Builds the owner contexts over one in-memory store, the way they run over one physical
/// database in tests. Sharing an explicit <see cref="InMemoryDatabaseRoot"/> is what lets a
/// test write through one owner context and read the row through another that maps the same
/// entity. (A10: the legacy god context is archived — owner contexts are the only mappings.)
/// </summary>
internal static class TestDatabases
{
 /// <summary>Every extracted owner context, all over the same store.</summary>
    internal sealed class ContextSet : IAsyncDisposable
    {
        private readonly InMemoryDatabaseRoot _root = new();
        private readonly string _name;

        public ContextSet(string name)
        {
            _name = name;
            Attachments = Create<AttachmentsDbContext>(options => new AttachmentsDbContext(options));
            Platform = Create<PlatformDbContext>(options => new PlatformDbContext(options));
            Valuation = Create<ValuationDbContext>(options => new ValuationDbContext(options));
            CaseStudy = Create<CaseStudyDbContext>(options => new CaseStudyDbContext(options));
            Identity = Create<IdentityDbContext>(options => new IdentityDbContext(options));
            Failures = Create<FailuresDbContext>(options => new FailuresDbContext(options));
            Operations = Create<OperationsDbContext>(options => new OperationsDbContext(options));
            Financial = Create<FinancialDbContext>(options => new FinancialDbContext(options));
            Messaging = Create<MessagingDbContext>(options => new MessagingDbContext(options));
        }

        public AttachmentsDbContext Attachments { get; }
        public PlatformDbContext Platform { get; }
        public ValuationDbContext Valuation { get; }
        public CaseStudyDbContext CaseStudy { get; }
        public IdentityDbContext Identity { get; }
        public FailuresDbContext Failures { get; }
        public OperationsDbContext Operations { get; }
        public FinancialDbContext Financial { get; }
        public MessagingDbContext Messaging { get; }

        public async ValueTask DisposeAsync()
        {
            await Messaging.DisposeAsync();
            await Financial.DisposeAsync();
            await Operations.DisposeAsync();
            await Failures.DisposeAsync();
            await Identity.DisposeAsync();
            await CaseStudy.DisposeAsync();
            await Valuation.DisposeAsync();
            await Platform.DisposeAsync();
            await Attachments.DisposeAsync();
        }

        private TContext Create<TContext>(Func<DbContextOptions<TContext>, TContext> create)
            where TContext : DbContext =>
            create(new DbContextOptionsBuilder<TContext>()
                .UseInMemoryDatabase(_name, _root)
                .Options);
    }

    public static ContextSet Create(string prefix) => new($"{prefix}-{Guid.NewGuid():N}");

    public static AttachmentsDbContext Attachments(string prefix) => Create(prefix).Attachments;

    public static PlatformDbContext Platform(string prefix) => Create(prefix).Platform;

    public static ValuationDbContext Valuation(string prefix) => Create(prefix).Valuation;

    public static CaseStudyDbContext CaseStudy(string prefix) => Create(prefix).CaseStudy;
}
