using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Development-only system reset over the per-service databases (the redesign the old
/// god-context walker needed after the split): wipes every owner context's operational and
/// prototype-config tables (audit schema preserved), purges registered non-org users through
/// the Identity maintenance graph, then re-runs the idempotent demo seed. Counts mirror the
/// old reset's response contract.
/// </summary>
public sealed class DevSystemMaintenanceService : ISystemMaintenanceService
{
    private readonly IConfiguration _configuration;
    private readonly string _connectionString;

    public DevSystemMaintenanceService(IConfiguration configuration, string connectionString)
    {
        _configuration = configuration;
        _connectionString = connectionString;
    }

    public async Task<SystemResetResultDto> ResetAllOperationalDataAsync(
        CancellationToken cancellationToken = default)
    {
        await using var root = DevSeedProvider.CreateResetProvider(_configuration, _connectionString);
        await using var scope = root.CreateAsyncScope();
        var sp = scope.ServiceProvider;

        var caseStudy = sp.GetRequiredService<CaseStudyDbContext>();
        var platform = sp.GetRequiredService<PlatformDbContext>();
        var valuation = sp.GetRequiredService<ValuationDbContext>();
        var failures = sp.GetRequiredService<FailuresDbContext>();
        var operations = sp.GetRequiredService<OperationsDbContext>();
        var financial = sp.GetRequiredService<FinancialDbContext>();
        var attachments = sp.GetRequiredService<AttachmentsDbContext>();
        var messaging = sp.GetRequiredService<MessagingDbContext>();

        var result = new SystemResetResultDto
        {
            WorkOrdersDeleted = await caseStudy.WorkOrders.CountAsync(cancellationToken),
            WorkflowTasksDeleted = await caseStudy.WorkflowTasks.CountAsync(cancellationToken),
            CaseStudyFormsDeleted = await caseStudy.CaseStudyForms.CountAsync(cancellationToken),
            CourtCatalogEntriesDeleted = await platform.CourtCatalogEntries.CountAsync(cancellationToken),
            CaseStudyInfoRolesConfigsDeleted =
                await platform.CaseStudyInfoRolesConfigs.CountAsync(cancellationToken),
            PropertyFailuresDeleted = await failures.PropertyFailures.CountAsync(cancellationToken),
            PoIntakeDraftsDeleted = await caseStudy.PoIntakeDrafts.CountAsync(cancellationToken),
            AttachmentsDeleted = await attachments.FileAttachments.CountAsync(cancellationToken),
            InternalDelegationLetterSetsDeleted =
                await caseStudy.InternalDelegationLetterSets.CountAsync(cancellationToken),
            EvaluatorRecallsDeleted = await valuation.EvaluatorRecallRecords.CountAsync(cancellationToken),
            FieldDictionaryConfigsDeleted =
                await platform.FieldDictionaryConfigs.CountAsync(cancellationToken),
            FailureTypesCatalogConfigsDeleted =
                await failures.FailureTypesCatalogConfigs.CountAsync(cancellationToken),
            SurveyOfficesDeleted = await operations.SurveyOffices.CountAsync(cancellationToken),
            ValuationRequestsDeleted = await valuation.ValuationRequests.CountAsync(cancellationToken),
            PropertyKeyRecordsDeleted = await operations.PropertyKeyRecords.CountAsync(cancellationToken),
            FinancialReportConfigsDeleted =
                await financial.FinancialReportConfigs.CountAsync(cancellationToken),
        };

 // Blob payloads are not reachable from the Case Study host (no IBlobStorage here) — same
 // as the old reset on this host; orphaned dev blobs are acceptable and re-listable.

        foreach (var db in new DbContext[]
                 {
                     caseStudy, valuation, failures, operations,
                     financial, attachments, messaging, platform,
                 })
        {
            await TruncateOwnedTablesAsync(db, cancellationToken);
        }

        var users = sp.GetRequiredService<IUserRegistrationService>();
        result.RegisteredUsersDeleted = await users.DeleteAllRegisteredAsync(cancellationToken);

 // One idempotent full seed restores demo users, catalogs, org config, and the
 // prototype module rows in every owner database.
        await DataSeeder.SeedAsync(sp, cancellationToken);

        return result;
    }

 /// <summary>
 /// TRUNCATE every table the context maps, on that context's own database. CASCADE keeps
 /// FK order irrelevant (the model has no cross-schema FKs); the audit schema is preserved
 /// like the old reset; the migrations-history tables are not part of the EF model.
 /// </summary>
    private static async Task TruncateOwnedTablesAsync(DbContext db, CancellationToken cancellationToken)
    {
        var tables = db.Model.GetEntityTypes()
            .Select(entity => (Schema: entity.GetSchema(), Table: entity.GetTableName()))
            .Where(t => !string.IsNullOrEmpty(t.Table))
            .Where(t => !string.Equals(t.Schema, "audit", StringComparison.Ordinal))
            .Select(t => t.Schema is { Length: > 0 } ? $"\"{t.Schema}\".\"{t.Table}\"" : $"\"{t.Table}\"")
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (tables.Count == 0) return;

        var sql = $"TRUNCATE TABLE {string.Join(", ", tables)} RESTART IDENTITY CASCADE";
        await db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }
}
