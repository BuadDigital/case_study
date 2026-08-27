using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Shared.Web.Middleware;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

public class OptimisticConcurrencyConfigurationTests
{
    private static readonly Type[] ProtectedEntities =
    [
        typeof(UserProfile),
        typeof(WorkOrder),
        typeof(WorkflowTask),
        typeof(PartyTaskSubmission),
        typeof(FieldInspectionWorkspace),
        typeof(InspectorFeeLedger),
        typeof(PartyBillingStatement),
        typeof(PropertyFailure),
        typeof(CaseStudyForm),
        typeof(ValuationRequest),
        typeof(PropertyKeyRecord),
        typeof(KeyEnvelope),
        typeof(KeyEnvelopeAssignment),
        typeof(KeyEnvelopeHandoff),
        typeof(PropertyCourtAccess),
        typeof(KeyReceiptFeeCharge),
        typeof(CourtVisitFeeCharge),
        typeof(OperationsTask),
        typeof(EvaluatorRecallRecord),
        typeof(PartyFeePricingTable),
        typeof(PartyFeePricingTier),
        typeof(PartyFeePricingAssignment),
    ];

    [Fact]
    public void Mutable_state_entities_use_Postgres_xmin_as_their_row_version()
    {
        var contexts = CreateModelOnlyOwnerContexts();
        try
        {
            foreach (var clrType in ProtectedEntities)
            {
                var mappings = contexts
                    .Select(db => db.Model.FindEntityType(clrType))
                    .Where(entity => entity is not null)
                    .ToList();
                Assert.True(
                    mappings.Count > 0,
                    $"{clrType.Name} is not mapped by any owner context.");

                foreach (var entity in mappings)
                {
                    var version = entity!.FindProperty("Version");
                    Assert.NotNull(version);
                    Assert.True(version.IsConcurrencyToken);
                    Assert.Equal(ValueGenerated.OnAddOrUpdate, version.ValueGenerated);
                    Assert.Equal("xmin", version.GetColumnName());
                    Assert.Equal("xid", version.GetColumnType());
                }
            }
        }
        finally
        {
            foreach (var db in contexts)
                db.Dispose();
        }
    }

 /// <summary>
 /// Owner contexts built for model inspection only — Npgsql provider so the relational
 /// xmin/xid mapping is present, but no connection is ever opened.
 /// </summary>
    private static DbContext[] CreateModelOnlyOwnerContexts() =>
    [
        ModelOnly<AttachmentsDbContext>(options => new AttachmentsDbContext(options)),
        ModelOnly<PlatformDbContext>(options => new PlatformDbContext(options)),
        ModelOnly<ValuationDbContext>(options => new ValuationDbContext(options)),
        ModelOnly<CaseStudyDbContext>(options => new CaseStudyDbContext(options)),
        ModelOnly<IdentityDbContext>(options => new IdentityDbContext(options)),
        ModelOnly<FailuresDbContext>(options => new FailuresDbContext(options)),
        ModelOnly<OperationsDbContext>(options => new OperationsDbContext(options)),
        ModelOnly<FinancialDbContext>(options => new FinancialDbContext(options)),
        ModelOnly<MessagingDbContext>(options => new MessagingDbContext(options)),
    ];

    private static TContext ModelOnly<TContext>(
        Func<DbContextOptions<TContext>, TContext> factory)
        where TContext : DbContext
    {
        var options = new DbContextOptionsBuilder<TContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=test;Password=test")
            .Options;
        return factory(options);
    }

    [Fact]
    public async Task Middleware_returns_409_for_a_concurrency_conflict()
    {
        var middleware = new GlobalExceptionHandlerMiddleware(
            _ => throw new DbUpdateConcurrencyException("stale row"),
            NullLogger<GlobalExceptionHandlerMiddleware>.Instance,
            new TestHostEnvironment());
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.Equal((int)HttpStatusCode.Conflict, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);

        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();

 // Read the payload rather than the raw text: the detail is Arabic, which the
 // default serializer emits as \u escapes.
        using var problem = JsonDocument.Parse(body);
        Assert.Equal(409, problem.RootElement.GetProperty("status").GetInt32());
        Assert.Contains(
            "تم تحديث السجل من طلب آخر",
            problem.RootElement.GetProperty("detail").GetString());
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } =
            new NullFileProvider();
    }
}
