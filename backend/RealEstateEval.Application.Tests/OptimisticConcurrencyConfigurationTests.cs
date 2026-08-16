using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Web.Middleware;

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
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=test;Password=test")
            .Options;
        using var db = new ApplicationDbContext(options);

        foreach (var clrType in ProtectedEntities)
        {
            var entity = db.Model.FindEntityType(clrType);
            Assert.NotNull(entity);

            var version = entity.FindProperty("Version");
            Assert.NotNull(version);
            Assert.True(version.IsConcurrencyToken);
            Assert.Equal(ValueGenerated.OnAddOrUpdate, version.ValueGenerated);
            Assert.Equal("xmin", version.GetColumnName());
            Assert.Equal("xid", version.GetColumnType());
        }
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
